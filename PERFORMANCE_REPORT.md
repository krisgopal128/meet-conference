# meet-conference Frontend Performance Profile

**Date:** 2026-06-28
**Target:** `meet-frontend/` (Vite + React 18 + TypeScript + LiveKit)
**Build:** local `npm run build` (matches deployed prod at https://meet.livekit.phuket-tourist.com — verified identical gzip sizes; deployed entry `index-CJBbo9qJ.js` ≈ local `index-meYn6ssJ.js` at ~34KB gzipped / ~94KB raw)
**Profiling:** Playwright (chromium, headless) against production URL + Vite build output analysis + static source review.

Severity scale: **P1** = blocks ship / user-visible perf regression. **P2** = significant, should fix soon. **P3** = nice-to-have polish.

---

## 1. JavaScript Bundle Sizes & Code-Splitting

### Build summary
- **214 JS chunks, 9.6 MB total raw** (~2.8 MB gzipped) in `dist/assets/`.
- Routing is **well-structured**: every page is `React.lazy()` + `Suspense` (`src/router.tsx:11-36`). Heavy panels (Chat/Participants/Settings/Whiteboard) are lazy inside `ConferenceRoom.tsx:42-45`. Excalidraw is dynamically imported inside `WhiteboardLayout.tsx:38-43`.
- `vite.config.ts:64-69` already configures `advancedChunks` for `vendor`, `livekit`, `icons`.

### Findings

#### 🟠 P2 — Oversized shared chunk `chunk-EIO257PC` (1.82 MB raw / 744 KB gzip)
This is the **Emscripten/WASM background-blur segmentation processor** (`@livekit/track-processors` + the bundled `selfieSegmentationTransformer`). It is the single largest artifact and dwarfs everything else.
- **Mitigated:** The app already defers the WASM download — `useBackgroundBlurPreview.ts:43-44` only initializes the worker "when blur is actually enabled", and `vite.config.ts:56` filters the blur processor out of `modulePreload`. So it is *not* fetched on initial page load.
- **Action:** Confirm via DevTools that no user on `/login`, `/`, `/join/:room` (without enabling blur) ever requests this chunk. If confirmed, no code change needed. If the chunk is referenced from the entry graph eagerly, move the `@livekit/track-processors` import behind a dynamic `import()` at the call site (`src/utils/backgroundEffectsManager.ts`).

#### 🟠 P2 — `livekit-*` chunk (670 KB raw / 181 KB gzip)
`livekit-BjY7FNBF.js` is the LiveKit client + components-react bundle. It's correctly split into its own chunk and only loaded by `RoomPage`/`PreJoinPage` (both lazy).
- **Action:** Acceptable for a video-conferencing app. `PreJoinPage.tsx:54-59` already **prefetches the `RoomPage` chunk 1s after PreJoin mounts** — good practice, keep it. No change required.

#### 🟡 P3 — `prod-C-ITV691.js` (509 KB raw / 153 KB gzip) = Excalidraw i18n locale bundles
Confirmed by content scan (`excalidraw--mobile`, `excalidraw--view-mode`, `library-unit--*`, and dozens of `assets/<locale>-*.js` references). Excalidraw bundles ~50 locale dictionaries into one chunk.
- **Action (P3):** Low priority — only loaded when a user opens the whiteboard, and `stripLazyCSS()` in `vite.config.ts:6-13` already strips the excalidraw CSS link. If you want to trim further, Excalidraw supports loading a single locale via `lang` prop; passing it would let the bundler drop unused locale data.

#### 🟡 P3 — Mermaid diagram chunks (`chunk-NNHCCRGN` 585 KB + ~40 diagram-type chunks)
Confirmed (`classDef`, `erDiagram`, `mermaid` markers). Mermaid is a transitive dep of Excalidraw and is **already code-split per diagram type** (sequence/architecture/gantt/etc. each in their own lazy chunk). Only relevant if a whiteboard embeds mermaid — otherwise dead code that could be excluded.
- **Action (P3):** If Mermaid is unused in the product, add it to `optimizeDeps.exclude` / mark it external in the Excalidraw dynamic import. Otherwise leave as-is.

#### ✅ Good — `index-*` (94 KB raw / 34 KB gzip), `vendor-*` (299 KB raw / 96 KB gzip), `icons-*` (20 KB)
Entry + React/router/Radix + lucide-react are right-sized and preloaded via `<link rel="modulepreload">` in `dist/index.html`.

### Server-side observation (not the app's code)
`https://meet.livekit.phuket-tourist.com/assets/*.js` returns **`content-length: 20`** for gzipped responses (Caddy `file_server` + `encode` returning stale precompressed metadata). The body is actually served correctly (curl with `--compressed` decodes the full file), but the misreported `Content-Length` can confuse some clients/proxies/CDNs. **Action:** check Caddy `encode` / `file_server` precompressed-gzip config (server/infra, not frontend).

---

## 2. Page Load Metrics (Playwright, production URL)

Anonymous (unauthenticated) measurements. Protected routes (`/`, `/history`, `/schedule`) redirect client-side to `/login`, so their "page chunk" never downloads — the numbers below reflect the **real anonymous experience** (SPA shell + auth redirect). `/login` and `/join/:room` are the meaningful full-load measurements.

| Route | TTFB | DOMContentLoaded | Load | FCP | Requests | Transfer (gzip) | JS transfer |
|---|---|---|---|---|---|---|---|
| `/login` | 782 ms | **2435 ms** | 2435 ms | 2452 ms | 11 | **160 KB** | 146 KB |
| `/` (→/login) | 274 ms | 291 ms | 292 ms | 304 ms | 14 | 3.9 KB | 3.6 KB |
| `/history` | 273 ms | 284 ms | 285 ms | 296 ms | 14 | 3.9 KB | 3.6 KB |
| `/schedule` | 254 ms | 265 ms | 267 ms | 284 ms | 14 | 3.9 KB | 3.6 KB |
| `/join/test-room` | 761 ms | **1807 ms** | 1807 ms | 1820 ms | 23 | **418 KB** | 395 KB |
| `/404` | 262 ms | 274 ms | 275 ms | 288 ms | 14 | 3.9 KB | 3.6 KB |

(0 long tasks on any route; DOM node counts 77–201.)

### Findings

#### 🔴 P1 — `/login` DCL is 2.4 s despite a tiny payload (160 KB)
- `/login` only ships 160 KB total (146 KB JS) yet `DOMContentLoaded` is **2435 ms** and FCP **2452 ms** — TTFB alone is 782 ms. The gap (782 ms → 2435 ms = ~1.65 s) is spent parsing/executing the `vendor` + `index` chunks and hydrating.
- The protected routes (`/`, `/history`, etc.) hit DCL in ~280 ms because **ProtectedRoute bails out to `/login` before their lazy chunks load** — so they look fast but actually impose an extra redirect round-trip for authed users.
- **Action (P1):** Profile hydration with Chrome DevTools Performance tab on `/login`. Likely contributors: (a) the global `authApi.refresh()` fire on `AppRoot` mount (`main.tsx:23-34`) races hydration; (b) `react-hot-toast` + router bootstrap on the critical path. Consider deferring non-critical init and adding `<link rel="modulepreload">` hints for the `/login` page chunk in `index.html` (currently only `index`/`vendor`/`icons`/`rolldown-runtime` are preloaded — the LoginPage chunk itself is not).

#### 🟠 P2 — `/join/:room` (PreJoin) loads 418 KB and takes 1.8 s
- This is the **single biggest anonymous entry** (guests click a meeting link → land here). 395 KB JS includes the PreJoin chunk (52 KB), sharedTracks, vendor, and the background-blur engine code path.
- **Action (P2):** PreJoin is already well-optimized (prefetches RoomPage at `PreJoinPage.tsx:54-59`, uses deferred data loading). The 1.8 s is dominated by vendor + LiveKit scaffolding needed for device preview. Consider: (1) a static/SSR'd hero shell for the PreJoin form so the user sees UI <500ms while device-permission JS loads in the background; (2) ensure the `livekit` chunk is *not* pulled into PreJoin's initial graph (it should only be needed for `RoomPage`). Verify with a chunk graph (`rollup-plugin-visualizer`).

---

## 3. Memory Leaks (intervals / timeouts / listeners)

I audited every `setInterval`, `setTimeout`, `requestAnimationFrame`, `addEventListener`, and `IntersectionObserver` in `src/`. **The codebase is, on the whole, exceptionally disciplined here** — virtually every effect returns a cleanup that clears its timer/observer and removes its listener. Notable well-handled cases:
- `useMicLevelMeter.ts:112-130` — closes AudioContext, stops tracks, cancels RAF. ✅
- `useNetworkQuality.ts:259-265` — clears interval + debounce timer. ✅
- `useQualityMonitoring.ts:196-204` — clears interval + recovery timer, offs room/participant events. ✅
- `useCallHealthMonitor.ts:180-183` — clears interval, sets `cancelled`. ✅
- `useVisibleParticipants.ts:202-209` — disconnects all IntersectionObservers, clears RAF + cull timers. ✅
- `useBackgroundBlurPreview.ts:96-107, 211-216` — cancels RAF, clears retry timer, posts `destroy` to worker. ✅
- `useWhiteboardSync.ts:268-273` — clears broadcast timer. ✅
- `ConferenceRoom.tsx:161-169` — clears active-speaker promote/demote timers, offs room events. ✅
- `ChatPanel.tsx:321-342` — clears typing + draft-cache timers on unmount AND publishes "stopped typing". ✅

### Findings

#### 🔴 P1 — Confirmed leak: orphaned `setTimeout` in `HomePage.handleCopyLink`
- **File:** `src/pages/HomePage.tsx:286`
- `setTimeout(() => setCopied(null), 2000);` is fired inside `handleCopyLink` but its handle is **never stored and never cleared on unmount**. If the user copies a link and navigates away within 2 s, `setCopied` fires on an unmounted component → React warning + retained closure.
- **Contrast:** the *other* copy handler in the same file (`HomePage.tsx:714-716, 725-727`) correctly stores the handle in `copiedTimerRef` and clears it. So this is an oversight, not a pattern.
- **Fix:** store the handle in a ref and clear it in the existing unmount cleanup (`HomePage.tsx:91-95`).

#### 🟡 P3 — `main.tsx:71-76` adds a global `error` listener with no removal
- `window.addEventListener('error', …)` for the stale-chunk auto-reload is added at module top level and never removed. This is **intentional** (it must live for the entire app lifetime) and harmless, but worth noting for completeness. No action.

#### ✅ No other leaks found
The `mountedRef`/`cancelled`/`isMountedRef` guard pattern is applied consistently to async fetches (`HomePage.tsx`, `useNetworkQuality.ts`, `useCallHealthMonitor.ts`, battery handling in `ConferenceRoom.tsx:242-275`).

---

## 4. Unnecessary Re-renders

### Findings

#### 🟠 P2 — `ChatPanel.visibleMessages` is recomputed every render and used as an effect dep
- **File:** `src/components/panels/ChatPanel.tsx:301-319`
- `const visibleMessages = messages.filter(...)` runs on **every render** (not memoized), producing a new array reference each time. It is then passed to `<ChatMessageList messages={visibleMessages} …/>` (line 618) and used as a `useEffect` dependency (line 319) — so the scroll-to-bottom effect fires on every parent re-render, and `ChatMessageList` re-renders even when messages haven't changed.
- Any ChatPanel state change (typing `input`, mention dropdown, poll creator toggles) currently re-filters the entire message list and re-renders it.
- **Fix:** wrap in `useMemo`:
  ```ts
  const visibleMessages = useMemo(
    () => messages.filter(m => !m.isPrivate || m.senderIdentity === localParticipant?.identity || (m.recipientRole === 'moderator' && isModerator)),
    [messages, localParticipant?.identity, isModerator],
  );
  ```
- Same pattern applies to `activeTypers` (`ChatPanel.tsx:313-315`) — also unmemoized, recomputed each render. Lower impact but trivial to memoize.

#### 🟠 P2 — `GridLayout` / `SpeakerLayout` allocate fresh inline `style={{…}}` objects per render
- **Files:** `src/components/room/GridLayout.tsx:70-76, 98-106, 125-141, 149`; `src/components/room/SpeakerLayout.tsx:76-82, 101-108`.
- `ParticipantTile` is wrapped in `memo` (`ParticipantTile.tsx:419`) and its `className`/`participantCount` props are stable, but the parent layouts pass `style={{ ... }}` objects inline to wrapper `<div>`s. The wrapper divs themselves re-render on every parent render — acceptable for the wrappers, but **every `useParticipants()` update** (someone speaks, mutes, or a stats tick fires) re-runs `GridLayout`'s render, rebuilding every inline style object and re-vdiffing all tile wrappers.
- `GridLayout` and `SpeakerLayout` are **not memoized** at the component level.
- **Fix (P2):** wrap `GridLayout` and `SpeakerLayout` exports in `React.memo`, and hoist the static style objects to module scope (the way `RoomPage.tsx:33` already does with `FULLSCREEN_STYLE`) or compute them with `useMemo` keyed on `[count, aspectRatio, isMobile]`.

#### 🟡 P3 — `ConferenceRoom` inline-style on root container
- **File:** `src/components/room/ConferenceRoom.tsx:311`
- `style={{ paddingTop: 'max(0.375rem, env(safe-area-inset-top, 0px))' }}` is allocated inline each render. `ConferenceRoom` is `memo`'d (line 419) so this only re-allocates when its props change — low impact. **Fix (P3):** hoist to a module-scope constant.

#### 🟡 P3 — `HomePage` `stats.map` rebuilds icon elements each render
- **File:** `src/pages/HomePage.tsx:360-369`
- `stats.map((stat, i) => { const Icon = stat.icon; return <div>…<Icon/>…})` allocates fresh elements on every render. `stats` is set via `setStats(newStats)` (line 180) and is otherwise stable, so this only matters because `HomePage` re-renders on focus events (`HomePage.tsx:83-88`) and form input. **Fix (P3):** wrap the stats row in a memoized subcomponent or `useMemo` on `[stats]`.

#### ✅ Good patterns observed
- `Layout.tsx:19-25` — `BASE_NAV_ITEMS`/`API_KEYS_ITEM` hoisted to module scope; `navItems` memoized on `[user?.role]` (line 39-45).
- `ControlBar.tsx:60-82` — imports a suite of pre-memoized button subcomponents (`MicButton`, `CameraButton`, …, `MemoizedMoreMenu`).
- `roomStore.ts` slice architecture with ~30 granular selector hooks (`useLayout`, `useChatOpen`, …) — each component subscribes only to the slice it needs, avoiding global store re-renders.
- `ConferenceRoom.tsx:42-45` — heavy panels lazy-loaded so they don't sit in the render tree until opened.
- `ParticipantTile.tsx:419` — `memo`'d; uses `forceRender` counter pattern for LiveKit track events instead of binding reactive state.

---

## Summary of Recommendations (no fixes applied — report only)

| # | Sev | Area | File:Line | Recommendation |
|---|---|---|---|---|
| 1 | P1 | Memory leak | `src/pages/HomePage.tsx:286` | Store `setTimeout` handle in a ref; clear on unmount (mirror the pattern at lines 714-716). |
| 2 | P1 | Load perf | `/login` route | Investigate 2.4 s DCL on 160 KB payload — profile hydration; add `modulepreload` for the LoginPage chunk; defer `authApi.refresh()` off the critical path (`src/main.tsx:23`). |
| 3 | P2 | Re-render | `src/components/panels/ChatPanel.tsx:301-319` | `useMemo` `visibleMessages` (and `activeTypers`) to stop re-filtering + re-rendering the message list on every keystroke. |
| 4 | P2 | Re-render | `src/components/room/GridLayout.tsx`, `SpeakerLayout.tsx` | Wrap both in `React.memo`; hoist inline `style` objects to module scope or `useMemo`. |
| 5 | P2 | Bundle | `chunk-EIO257PC` (1.82 MB WASM blur) | Verify it's never eagerly imported; if unsure, dynamic-`import()` `@livekit/track-processors` at the call site in `backgroundEffectsManager.ts`. |
| 6 | P2 | Load perf | `/join/:room` (418 KB, 1.8 s) | Consider SSR/static hero shell; verify `livekit` chunk isn't in PreJoin's initial graph. |
| 7 | P3 | Bundle | `prod-C-*.js` (Excalidraw locales, 509 KB) | Pass `lang` prop to Excalidraw to drop unused locales. |
| 8 | P3 | Bundle | Mermaid chunks (~585 KB+) | If Mermaid unused, exclude from Excalidraw dynamic import. |
| 9 | P3 | Re-render | `src/components/room/ConferenceRoom.tsx:311` | Hoist inline `style` to module constant. |
| 10 | P3 | Re-render | `src/pages/HomePage.tsx:360-369` | Memoize stats row. |
| 11 | P3 | Infra | Caddy `Content-Length: 20` on gzip | Server-side fix (not frontend) — check `encode`/precompressed config. |

**Overall assessment:** The frontend is **above average** in performance hygiene — lazy-loading is thorough, timers/listeners are cleaned up rigorously, and the Zustand store is sliced correctly. The two P1s (one real `setTimeout` leak in HomePage, and the slow `/login` hydration) are the highest-value fixes. The P2 re-render items in ChatPanel and the grid layouts are the biggest "free perf" wins for in-meeting smoothness.

---

## Artifacts produced
- `profile-frontend.mjs` — Playwright profiling script (reusable).
- `perf-profile-results.json` — raw per-route metrics from the production URL.
- `PERFORMANCE_REPORT.md` — this report.
