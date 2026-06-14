# Product Requirements Document (PRD)

## Realtime Background Blur (Web)

| Field | Value |
|---|---|
| **Project** | Camera_BG_Blur |
| **Document version** | 1.0 |
| **Status** | Implemented |
| **Platform** | Web browser (client-side only) |
| **Stack** | Vanilla HTML / CSS / JavaScript (no build step, no framework) |
| **ML runtime** | MediaPipe Selfie Segmentation (Apache-2.0), served via CDN |
| **Application code license** | MIT |
| **Last updated** | 2026-06-14 |

---

## 1. Executive Summary

Realtime Background Blur is a zero-dependency, single-page web application that
applies a live background blur (or replacement) to a user's webcam feed. All
machine-learning inference and image compositing happen **entirely on-device**
in the browser — no video frames are ever transmitted to a server. The product
targets privacy-conscious users who want professional-looking webcam output for
video calls, streaming, or recording without installing native software.

The app uses Google's **MediaPipe Selfie Segmentation** model (the same model
family powering Google Meet's background effects) to separate the subject from
the background, then composites a blurred (or replaced) background with the
sharp subject using GPU-accelerated canvas operations.

---

## 2. Problem Statement

Built-in camera apps and video-conferencing tools often lack real-time
background blur, or require it to be enabled inside a specific app, or send
video to the cloud for processing. Users want:

- A **universal**, browser-based tool that works regardless of the meeting
  platform.
- Strong **privacy guarantees** — no video leaving the device.
- **High-quality** segmentation without visible halos, shadows, or flicker.
- **Good performance** on typical consumer laptops without a discrete GPU.
- A solution that is **freely licensed** for commercial reuse.

---

## 3. Goals & Non-Goals

### Goals
1. Deliver real-time (≥ 24 FPS on a typical laptop) webcam background blur
   entirely in the browser.
2. Produce a clean composite: no colored halo around the subject, no dark edge
   shadow, and no flicker on the scene edges during subject motion.
3. Guarantee on-device processing — zero network transmission of video frames.
4. Offer multiple background modes (blur, image, solid color, passthrough).
5. Use only permissively licensed dependencies (Apache-2.0 / MIT).
6. Keep the project build-free and dependency-free (one HTML file, CSS, JS).

### Non-Goals
1. Not a video-chat application — it does not transmit audio/video to peers.
2. Not a virtual camera driver — it does not register as a system camera
   (OBS-level integration is out of scope).
3. No server-side component, accounts, or persistent storage.
4. No multi-person segmentation tuning (the model is optimized for one subject
   within ~2 m of the camera).
5. No mobile-first native app (the web app is responsive but desktop-optimized).

---

## 4. Target Users

| Persona | Primary need |
|---|---|
| Remote workers | Look professional on calls without a tidy background. |
| Streamers / creators | A free, private backdrop tool for recording. |
| Privacy-conscious users | Assurance that video never leaves their device. |
| Developers / tinkerers | A readable, hackable reference implementation. |

---

## 5. User Stories

- **US-1:** As a user, I can start my camera with one click and immediately see
  my background blurred.
- **US-2:** As a user, I can adjust the blur intensity to taste.
- **US-3:** As a user, I can replace my background with an uploaded image.
- **US-4:** As a user, I can set a solid color background.
- **US-5:** As a user, I can disable the effect to compare raw vs. processed.
- **US-6:** As a user, I can mirror the preview so it feels like a mirror.
- **US-7:** As a user, I can see a live microphone level indicator so I know my
  mic is capturing audio.
- **US-8:** As a user, I can see the current frame rate.
- **US-9:** As a user, I expect the background to stay blurred even when I move
  toward the camera (no edge flicker).
- **US-10:** As a user, I expect no colored halo or dark shadow around me.

---

## 6. Functional Requirements

### FR-1 — Camera capture
- The app shall request webcam access via `navigator.mediaDevices.getUserMedia`.
- It shall request 1280×720 (16:9) video, `facingMode: "user"`, no audio.
- It shall handle permission denial with a clear on-screen message.
- The raw `<video>` element shall remain hidden; the visible output is a
  composited `<canvas>`.

### FR-2 — Person segmentation
- The app shall use MediaPipe Selfie Segmentation (`@mediapipe/selfie_segmentation`)
  loaded from the jsDelivr CDN.
- It shall use the **landscape** model variant (`modelSelection: 1`).
- Inference shall run on the live video frame and produce a binary person mask
  at the model's native 256×256 resolution.

### FR-3 — Background modes
The app shall support four background modes, selectable at runtime:

| Mode | Behavior |
|---|---|
| **Blur** (default) | Background is a blurred copy of the camera frame. |
| **Image** | Background is a user-uploaded image, cover-fit. |
| **Color** | Background is a user-chosen solid color. |
| **None** | Passthrough — raw frame, effect effectively off. |

### FR-4 — Blur intensity
- The Blur mode shall expose an intensity slider, range **0–40 px**.
- Blur shall be applied via the GPU-accelerated `ctx.filter = 'blur(Npx)'`.

### FR-5 — Composite quality (anti-halo & anti-shadow)
- **Anti-halo:** Before blurring, the subject shall be removed from a copy of
  the frame (knockout via `destination-out`) so subject colors cannot bleed into
  the background.
- **Anti-shadow:** The blurred knockout shall be **stacked 8×** so the
  subject's former region converges to fully-opaque background color,
  preventing a dark shadow band at the subject's edge (critical at blur values
  < 30 px).

### FR-6 — Mask stabilization
To prevent the background from briefly turning sharp during motion:
- **Temporal:** the mask shall be smoothed with a per-frame EMA blend
  (`MASK_EMA = 0.5`), implemented with pure GPU compositing (`"lighter"` +
  `globalAlpha`).
- **Spatial (edge vignette):** the mask shall be multiplied by a smooth
  border-suppression vignette (`MASK_EDGE_MARGIN = 0.08`) forcing the outer ~8%
  of the frame to always be classified as background.
- **Constraint:** the stabilization stage shall **never** use
  `getImageData`/`putImageData` per frame (a previous implementation stalled
  the WebGL inference pipeline and froze the camera).

### FR-7 — Edge feather
- The subject cutout shall optionally feather its edges via a blurred mask.
- The feather slider shall have a **minimum of 3 px** and maximum of 8 px
  (default 3 px).

### FR-8 — Voice level indicator
- The app shall request microphone access (separate stream, non-blocking; a
  denial shall not affect the camera).
- It shall compute the input level (RMS) via the Web Audio API `AnalyserNode`.
- A live meter bar shall reflect the level with fast attack / slow release.
- If the mic is unavailable, the meter shall show "MIC OFF" and remain idle.

### FR-9 — Performance cap
- The segmentation render loop shall be **capped at 30 FPS** to keep CPU/GPU
  usage predictable across devices. The voice meter shall still update at full
  animation-frame rate.

### FR-10 — Reliability
- The render loop shall **never** terminate due to a per-frame error: all frame
  work is wrapped so that `requestAnimationFrame` is always rescheduled
  (`try/catch/finally`), and a failing frame is logged and skipped.

### FR-11 — UI controls
- Start/Stop camera button (toggles label & style).
- Effect on/off switch.
- Background mode selector (shows/hides relevant sub-controls).
- Blur intensity slider (blur mode).
- Background image file picker (image mode).
- Background color picker (color mode).
- Edge feather slider.
- Mirror switch.
- FPS badge (top-right of preview).
- Microphone meter (bottom-left of preview).

### FR-12 — Visual identity
- Dark glassmorphism UI with a purple (`#7c5cff`) → cyan (`#4cd1ff`) accent
  gradient.
- A custom SVG favicon (lens/aperture motif in the accent gradient).
- Responsive layout collapsing to a single column on narrow screens.

---

## 7. Non-Functional Requirements

### NFR-1 — Privacy
- **Zero network transmission** of video or audio frames. All ML inference and
  compositing is local.
- The only network requests are the one-time CDN fetch of the MediaPipe runtime
  and model weights (cacheable).

### NFR-2 — Performance
- Target ≥ 24 FPS (capped at 30) on a mid-range laptop with an integrated GPU.
- Per-frame GPU work kept bounded (no per-frame CPU readbacks; mask work at
  256×256).

### NFR-3 — Compatibility
- Chrome / Edge / Brave (desktop & Android).
- Firefox.
- Safari 14+ / iOS Safari (supports `getUserMedia` + `ctx.filter` blur).
- Requires `http(s)://` or `localhost` (camera is blocked on `file://`).

### NFR-4 — Accessibility
- Interactive controls are keyboard-reachable native elements (`<input>`,
  `<select>`, `<button>`).
- Decorative SVG icons are `aria-hidden`.

### NFR-5 — Robustness
- A denied microphone must not break the camera.
- A denied camera must show a clear message and not leave the UI in a broken
  state.
- A single failing inference frame must not freeze the preview.

---

## 8. Technical Architecture

```
index.html ── markup + CDN script tag (MediaPipe) + favicon
css/style.css ── dark glass UI, meter, controls
js/app.js ── all logic
favicon.svg ── brand icon
```

### 8.1 Runtime pipeline (per processed frame)

```
hidden <video>
     │
     ▼
MediaPipe.send(video)  ──►  raw person mask (256×256)
     │
     ▼
stabilizeMask()  ──►  temporal EMA  →  edge vignette  (GPU compositing only)
     │
     ▼
renderBackground() ──►  bgCanvas
     │  blur mode: knockout → blur → stack 8× (anti-halo + anti-shadow)
     │  image/color/none modes: cover-fill / fill / passthrough
     ▼
person cutout  ──►  personCanvas  (sharp frame × mask, destination-in, feathered)
     │
     ▼
composite bgCanvas + personCanvas  ──►  visible <canvas>
```

### 8.2 Loop & throttling
- A single `requestAnimationFrame` loop drives everything.
- The voice meter updates every animation frame (cheap).
- Segmentation (`MediaPipe.send`) is throttled to a 30 FPS cap via a timestamp
  gate (`FRAME_INTERVAL = 1000/30`).
- The whole frame body is wrapped in `try/catch/finally` so the loop is
  un-killable.

### 8.3 Key files & responsibilities

| File | Responsibility |
|---|---|
| `index.html` | Markup, control panel, MediaPipe CDN script, favicon link. |
| `css/style.css` | Visual design, layout, meter & switch styling, responsiveness. |
| `js/app.js` | Camera/mic lifecycle, segmentation loop, mask stabilization, compositing, UI wiring. |
| `favicon.svg` | Brand icon. |
| `README.md` | Setup, architecture overview, license research. |
| `LICENSE` | MIT for app code + Apache-2.0 notice for MediaPipe. |
| `PRD.md` | This document. |

### 8.4 External dependencies
- `@mediapipe/selfie_segmentation` (runtime + `selfie_segmentation_landscape`
  model weights), loaded from `cdn.jsdelivr.net`. License: Apache-2.0.

---

## 9. UI / UX Specification

- **Preview stage:** 16:9 canvas, centered, with a rounded border and shadow.
  - Top-right: FPS badge.
  - Bottom-left: microphone meter (icon + bar + status label).
  - Overlay card (spinner + status text) shown while idle/loading and hidden
    once streaming.
- **Control panel:** a responsive grid of control groups below the preview.
  - Contextual controls appear/disappear based on the selected background mode.
- **Footer:** a privacy assurance line.

---

## 10. Constraints & Assumptions

- The user has a working webcam and grants permission.
- The user is roughly within ~2 m of the camera (the model's design envelope).
- A reasonably modern browser with WebGL support is available.
- The CDN (jsDelivr) is reachable on first load (after that, assets are cached).

---

## 11. Licensing & Compliance

- **Application source** (`index.html`, `css/`, `js/`, `favicon.svg`): **MIT**.
- **MediaPipe runtime + model weights**: **Apache-2.0** (permissive; commercial
  use, modification, and redistribution allowed). Apache-2.0 is functionally
  equivalent to MIT and adds an explicit patent grant.
- **Rationale:** no fast, high-quality, strictly-MIT person-segmentation model
  exists for the browser; Apache-2.0 is the permissive standard and is the
  best-performing choice (see README "License research").
- **Obligation on redistribution:** retain the Apache-2.0 license/notice for
  the MediaPipe runtime and model weights alongside the MIT app code.

---

## 12. Success Metrics

| Metric | Target |
|---|---|
| Steady-state frame rate | ≥ 24 FPS (capped at 30) |
| First-frame latency (after camera grant) | < 3 s (model load) |
| Visible halo at subject edge | None |
| Visible dark shadow at subject edge (blur < 30 px) | None |
| Scene-edge flicker during motion | None |
| Network requests carrying video/audio frames | 0 |
| Camera-freeze incidents from per-frame errors | 0 |

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Model mis-classifies scene edges during fast motion → brief unblur | Edge vignette forces borders to background every frame. |
| Per-frame CPU readback stalls WebGL → camera freeze | Stabilization uses GPU compositing only; no `getImageData`. |
| Mic permission/UI mismatch could throw and kill the loop | Meter calls are null-guarded; loop wrapped in `try/catch/finally`. |
| Halo from subject colors bleeding into blur | Knockout the subject before blurring. |
| Dark shadow at low blur values | 8× stacking forces the fill fully opaque. |
| CDN unavailable | Document requirement; assets cache after first load. |
| License confusion (MIT vs. Apache) | Explicit dual-notice in `LICENSE` and README. |

---

## 14. Future Scope (Out of Scope for v1)

- Multi-subject / full-body (beyond ~2 m) segmentation tuning.
- Virtual camera driver / OBS integration.
- Recording / snapshot export of the composited output.
- Skin/hair/clothing multiclass segmentation (MediaPipe `SelfieMulticlass`).
- Server-side or peer-to-peer streaming of the composited stream.
- Adjustable vignette margin and EMA strength exposed in the UI.
- Unit/E2E tests and CI.

---

## 15. Open Questions

- Should the vignette margin (`MASK_EDGE_MARGIN`, currently 0.08) be
  user-adjustable to accommodate off-center framing?
- Is 30 FPS the right cap, or should it auto-scale based on measured inference
  time?
- Should the app offer to share the composited canvas as a MediaStream
  (`captureStream`) for direct use in `RTCPeerConnection`?
