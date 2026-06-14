# Comprehensive Codebase Audit Report

**Date:** 2026-06-14  
**Scope:** meet-backend + meet-frontend  
**Method:** 25+ chunk-by-chunk analysis  
**Categories:** Slow DB queries, Memory leaks, Excessive API calls, Server crashes under load, Duplicate code, Poor architecture, Inconsistent naming, Data leakage  

---

## HIGH Severity (15 issues)

### Data Leakage / Security

#### H1. Meeting chat endpoint leaks participant emails
- **File:** `meet-backend/src/routes/meetings.ts:472-488`
- **Category:** Data leakage
- **Details:** `GET /meetings/:id/chat` returns `u.email` for every chat message sender. Any meeting participant (not just host) can read every other participant's email address.
- **Fix:** Drop `u.email` from SELECT; align with rooms.ts chat endpoint which only returns `sender_identity` and `sender_name`.

#### H2. Meeting detail leaks all participant emails
- **File:** `meet-backend/src/routes/meetings.ts:273-280`
- **Category:** Data leakage
- **Details:** `GET /meetings/:id` returns `mp.*` + `u.email` for all participants. `verifyMeetingAccess` grants access to any participant, so attendees can enumerate emails.
- **Fix:** Strip emails from non-host responses; omit PII from cached payload.

#### H3. Stale moderator role after participant leaves
- **File:** `meet-backend/src/routes/token.ts:66-71`
- **Category:** Privilege escalation
- **Details:** Role query has no `left_at IS NULL` filter. A user who left as moderator retains moderator role on token requests until meeting ends.
- **Fix:** Add `AND left_at IS NULL ORDER BY joined_at DESC LIMIT 1`.

#### H4. Admin reset-password returns plaintext password
- **File:** `meet-backend/src/routes/prashasakah/users.ts:383-406`
- **Category:** Credential leak
- **Details:** `temporaryPassword` returned in HTTP response body. Captured by proxies, browser dev tools, logs.
- **Fix:** Never return passwords in API responses. Require admin to set password client-side or send via email.

#### H5. Missing UNIQUE constraint on meeting_participants
- **File:** `meet-backend/src/db/schema.sql:75-86`
- **Category:** Data corruption
- **Details:** No unique index on `(meeting_id, identity)`. `ON CONFLICT DO NOTHING` is a no-op. Every rejoin creates duplicate rows; `participant_left` UPDATE corrupts history.
- **Fix:** Add `CREATE UNIQUE INDEX idx_meeting_participants_meeting_identity ON meeting_participants(meeting_id, identity) WHERE left_at IS NULL;`

### Server Crashes / Performance

#### H6. No unhandledRejection / uncaughtException handler
- **File:** `meet-backend/src/index.ts`
- **Category:** Server crashes under load
- **Details:** Process registers SIGTERM/SIGINT but no promise rejection handler. Any unawaited rejection terminates Node ≥15.
- **Fix:** Add `process.on('unhandledRejection', ...)` and `process.on('uncaughtException', ...)`.

#### H7. Webhook fires 8 sequential DB queries per participant join
- **File:** `meet-backend/src/routes/webhook.ts:170-251`
- **Category:** Excessive API calls / Server crashes under load
- **Details:** 8 sequential round trips per join event. 100-person burst = 800 DB operations.
- **Fix:** Consolidate using CTEs or transaction; cache room row; batch updates.

#### H8. Mute-all fans out ~5 LiveKit RPCs × N participants + 350ms sleep each
- **File:** `meet-backend/src/routes/rooms.ts:453-466` + `services/livekit.ts:347`
- **Category:** Excessive API calls
- **Details:** 50 participants = ~250 RPCs plus 50 × 350ms sleeps within per-participant locks.
- **Fix:** Remove fixed 350ms sleep; batch mute; rate-limit concurrency.

#### H9. listParticipants() called to find ONE participant
- **File:** `meet-backend/src/routes/rooms.ts:370-371, 496-497`
- **Category:** Excessive API calls
- **Details:** Fetches ALL participants then `.find()` for one. `getParticipantInfo(name, identity)` already exists.
- **Fix:** Use `getParticipantInfo` instead.

### Frontend Memory Leaks

#### H10. whiteboardSceneCache Map never cleared
- **File:** `meet-frontend/src/components/room/WhiteboardLayout.tsx:56`
- **Category:** Memory leak
- **Details:** Module-scoped Map accumulates scenes + Excalidraw files per room. 50 rooms = all scenes in memory forever.
- **Fix:** Cap with LRU (max 5 entries) or clear on room disconnect.

#### H11. sceneRafRef not cancelled on unmount
- **File:** `meet-frontend/src/components/room/WhiteboardLayout.tsx:90`
- **Category:** Memory leak
- **Details:** `requestAnimationFrame` scheduled but no cleanup cancels it on unmount. Callback fires on unmounted component.
- **Fix:** Add `useEffect(() => () => { if (sceneRafRef.current) cancelAnimationFrame(sceneRafRef.current); }, [])`.

#### H12. chatPanelDraftCache never evicts
- **File:** `meet-frontend/src/components/panels/ChatPanel.tsx:29-36`
- **Category:** Memory leak
- **Details:** Module-scoped Map grows per room. Draft text (potentially sensitive) persists across sessions.
- **Fix:** Add LRU cap (max 10 rooms).

#### H13. SettingsPanel debounce timers not cleared on unmount
- **File:** `meet-frontend/src/components/panels/SettingsPanel.tsx:120-121`
- **Category:** Memory leak / setState on unmounted
- **Details:** `setTimeout` for aspect ratio and video fit mode debouncing. No cleanup clears them on unmount.
- **Fix:** Add `useEffect(() => () => { clearTimeout(saveAspectRatioTimerRef.current); clearTimeout(saveVideoFitModeTimerRef.current); }, [])`.

#### H14. ParticipantTile registers 5+ room listeners PER TILE
- **File:** `meet-frontend/src/components/room/ParticipantTile.tsx:156-272`
- **Category:** Server crashes under load / Poor architecture
- **Details:** 20-person call = 140 listeners. Combined with `forceRender`, speaker change = O(N²) re-renders.
- **Fix:** Move track subscription to parent; tiles consume via context.

#### H15. Request interceptor hard-redirects to /login mid-meeting
- **File:** `meet-frontend/src/services/api.ts:115-117`
- **Category:** UX-breaking bug
- **Details:** If any backend call fires with expired token during a meeting, user is kicked to /login. LiveKit room token (separate) is still valid.
- **Fix:** Remove redirect from request interceptor. Let response interceptor handle it (it has public-page guards).

---

## MEDIUM Severity (43 issues)

### Slow Database Queries
| # | Issue | File |
|---|-------|------|
| M1 | Missing composite index on `meeting_participants(meeting_id, user_id)` | `schema.sql` |
| M2 | Missing composite index on `chat_messages(meeting_id, created_at)` | `schema.sql` |
| M3 | N+1 correlated subquery in admin meetings list | `prashasakah/meetings.ts:119-130` |
| M4 | `SELECT *` on hot paths | `roomService.ts:54-57` |
| M5 | `SELECT DISTINCT m.*` with LEFT JOIN | `meetings.ts:54-63` |
| M6 | Unbounded participant query (no LIMIT) | `meetings.ts:273-280` |
| M7 | `ILIKE '%search%'` bypasses B-tree indexes | `users.ts:76`, `meetings.ts:90` |
| M8 | User rooms query feeds N+1 LiveKit API calls | `egress.ts:188-196` |

### Excessive API Calls
| # | Issue | File |
|---|-------|------|
| M9 | `requireModeratorRoomAccess` + inline fetch room 12+ times | `rooms.ts` |
| M10 | API key verification hits DB on every request (no cache) | `external.ts:94-156` |
| M11 | Dynamic `import()` in hot paths instead of static import | `auth.ts:69,81,90` |
| M12 | Redundant room lookup in `deleteRoomByName` | `roomService.ts:197-202` |
| M13 | Both ControlBar + ParticipantsPanel subscribe to lobby polling independently | `ControlBar.tsx:196` |
| M14 | WhiteboardPreviewTile polls every 2s even when idle | `WhiteboardPreviewTile.tsx:118-124` |
| M15 | useDataChannelHandler effect has 19 deps causing re-subscription churn | `useDataChannelHandler.tsx:187` |
| M16 | useAdaptiveQuality effect depends on unstable fullConfig object | `useAdaptiveQuality.ts:92-107` |
| M17 | `useParticipants()` called inside every ParticipantTile | `ParticipantTile.tsx:354-355` |
| M18 | `document.querySelectorAll('audio, video')` for speaker volume | `RoomPage.tsx:361-373` |

### Duplicate Code
| # | Issue | File |
|---|-------|------|
| M19 | LeaveButton vs MobileLeaveButton: ~80 lines identical | `ControlBarButtons.tsx:587-749` |
| M20 | `isModerator` inline check in 3 components (store has `useIsModerator()`) | `ConferenceRoom.tsx:94`, `PiPContainer.tsx:66`, `ChatPanel.tsx:88` |
| M21 | `ASPECT_RATIO_MULTIPLIERS` / `ASPECT_RATIO_CSS` in 4 layout files | `GridLayout/SpeakerLayout/ScreenShareLayout/WhiteboardLayout` |
| M22 | `publishData` payload encoding repeated 20+ times | Multiple hooks/components |
| M23 | Kick participant logic duplicated in DELETE and POST routes | `rooms.ts:353-384 vs 474-510` |
| M24 | `requireUser(req); if (!user)` boilerplate ~15 times | `rooms.ts`, `meetings.ts` |
| M25 | `SELECT host_id FROM rooms WHERE name` duplicated 7+ times | `egress.ts`, `external.ts`, `token.ts` |
| M26 | Token generation logic duplicated internal vs external | `external.ts:369` vs `livekit.ts:75` |
| M27 | Duplicate token-refresh logic in request + response interceptors | `api.ts:60-123 vs 140-208` |

### Poor Architecture
| # | Issue | File |
|---|-------|------|
| M28 | `routes/rooms.ts` is a 1006-line god file | `rooms.ts` |
| M29 | `services/redis.ts` is a 734-line god file | `redis.ts` |
| M30 | `roomStore.ts` is 799 lines with 5+ slices | `roomStore.ts` |
| M31 | `ConferenceRoom.tsx` is 562 lines (stats + battery + panels + mobile) | `ConferenceRoom.tsx` |
| M32 | Business logic in webhook route handler | `webhook.ts:114-391` |
| M33 | `getCached<T>` lies about nullability (`null as T`) | `cache.ts:47-83` |
| M34 | `backgroundEffectsManager` module-level singleton | `backgroundEffectsManager.ts:33-41` |
| M35 | `useWhiteboardAutoSave` mutates React refs with `__markDirty` | `useWhiteboardAutoSave.ts:67-69` |
| M36 | `meetingRoomConfig.ts` 280-line fallback duplicates JSONC | `meetingRoomConfig.ts:281-554` |
| M37 | `ControlBar.tsx` calls ~40 selector hooks per render | `ControlBar.tsx:89-134` |

### Inconsistent Naming
| # | Issue | File |
|---|-------|------|
| M38 | Role taxonomy: 7+ different role names across codebase | Multiple |
| M39 | Mixed camelCase/snake_case in API responses | `rooms.ts:870-875` |
| M40 | `useSettingsSync` only handles videoFitMode (misleading name) | `useSettingsSync.ts` |
| M41 | `useCallSizeConfig` uses string events instead of RoomEvent enum | `useCallSizeConfig.ts:44-45` |
| M42 | Text chevrons instead of lucide icons in prejoin components | `DeviceSettings.tsx:30`, `AudioSettings.tsx:23`, `VideoSettings.tsx:53` |
| M43 | `setQualityMode` action name doesn't match what it does (sets `selectedQualityMode`) | `roomStore.ts:365` |

---

## LOW Severity (28 issues)

### Backend
- `SELECT *` returns unnecessary columns (password_hash, metadata)
- Redis pool code is dead code (never called)
- `deleteRoomByName` does existence check then delete (TOCTOU)
- Dynamic `import('crypto')` alongside static import
- `IF NOT EXISTS` inconsistency in schema indexes
- Webhook signature failure leaks error message
- `/health` endpoint exposes version + env unauthenticated
- Diagnostics files accumulate without cleanup/rotation
- `hostLeaveTimeouts` Map cleanup only every 5 minutes

### Frontend
- `chatPanelDraftCache` updates on every keystroke (could debounce)
- `api.ts` uses non-standard axios properties (`__retryCount`, `_retry`)
- `HomePage.tsx` setTimeout for copied state not cleaned up
- `usePreJoinAuth` getRoom call has no cancellation
- `usePreviewBackgroundBlur` segmenter never closed on unmount
- Background image upload has no file-size limit
- `CreateMeetingForm` uses VideoOff icon for password visibility toggle
- Magic numbers in audio hooks (740Hz, 520Hz, 0.03 gain)
- `logger.info` calls in production (usePictureInPicture, useSettingsSync)
- `useAutoPiP` uses `Date.now()` instead of `performance.now()`
- Shared ref between desktop and mobile buttons in ControlBar
- `key={i}` anti-pattern in MoreMenu
- `_room`, `_participant` dead code in SettingsPanel
- Module-level mutable `persistedSpeakerVolume` in SettingsPanel

---

## Fix Priority Order

1. **H3** — Stale moderator role (privilege escalation)
2. **H5** — Missing UNIQUE constraint (data corruption)
3. **H4** — Plaintext password in response (credential leak)
4. **H1+H2** — Email leakage in meeting endpoints (PII)
5. **H6** — No unhandledRejection handler (crash risk)
6. **H15** — Request interceptor redirect (UX-breaking)
7. **H10-H13** — Memory leaks (whiteboard cache, rAF, draft cache, debounce timers)
8. **H9** — Excessive API calls (listParticipants for one)
9. **H14** — ParticipantTile listeners (O(N²) renders)
10. **H7+H8** — Webhook/mute-all throughput (server load)
