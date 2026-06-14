# God-File Refactor Plan (M28-M32, M34, M36)

**Backups:** `/tmp/opencode/refactor-backup/`  
**Strategy:** Extract-and-mount (not physical file moves). New files are created, original files import and re-export. All existing imports continue to work.

---

## M28: rooms.ts (1006 lines → ~450 lines)

**Current structure:**
- Lines 1-70: Imports + helpers (requireModeratorRoomAccess, assertModerator, executeKick, canAccessRoomChat)
- Lines 71-362: Room CRUD (create, list, detail, update, delete)
- Lines 363-610: Participant management (kick, mute, mute-video, mute-all, admit, lobby)
- Lines 611-736: Screen share + camera control
- Lines 737-850: Chat routes (GET/POST chat)
- Lines 850+: Room settings

**Plan:**
1. Create `routes/roomsParticipants.ts` — move all participant management routes (lines 363-610 + screen/camera 611-736) into a new `Router()`. Export `participantsRouter`.
2. Create `routes/roomsChat.ts` — move chat routes (lines 737-850) + `canAccessRoomChat` helper. Export `chatRouter`.
3. In `rooms.ts`: import and mount `roomsRouter.use(participantsRouter)` + `roomsRouter.use(chatRouter)`.
4. Move shared helpers (assertModerator, executeKick, requireModeratorRoomAccess) to a shared `services/roomAccess.ts` that both files import.

**Risk:** Medium. Router mounting is additive. If a route doesn't match in the sub-router, it falls through.

---

## M29: redis.ts (734 lines → ~400 lines)

**Current structure:**
- Lines 1-120: Connection pool (dead code) + init
- Lines 248-370: Generic cache (get/set/del/exists/ttl/incr)
- Lines 370-430: Pipeline operations
- Lines 435-500: Room state operations
- Lines 500-650: Participant presence (add/remove/get/count)
- Lines 650-734: Admitted/kicked tracking + token blacklist

**Plan:**
1. Create `services/participantPresence.ts` — move admitted/kicked participant functions (addAdmittedParticipant, isParticipantAdmitted, isGuestNameAdmitted, getAdmittedParticipant, removeAdmittedParticipant, addKickedParticipant, isParticipantKicked, isGuestNameKicked, removeKickedParticipant).
2. In `redis.ts`: re-export all moved functions so existing `import { ... } from '../services/redis.js'` still works.
3. Remove dead pool code (getPooledConnection, releaseConnection, connectionTimers, initPool) — confirmed never called.

**Risk:** Low. Re-export pattern preserves all import paths.

---

## M32: webhook.ts (392 lines → ~100 lines)

**Current structure:**
- Lines 1-88: Setup + signature verification
- Lines 89-392: Inline business logic for 7 event types

**Plan:**
1. Create `services/webhookService.ts` with functions: `handleRoomStarted(name)`, `handleRoomFinished(name)`, `handleParticipantJoined(name, identity, ...)`, `handleParticipantLeft(...)`, `handleEgressStarted(...)`, `handleEgressEnded(...)`.
2. Move the `hostLeaveTimeouts` Map + `scheduleHostLeaveCheck` into webhookService.ts.
3. In `webhook.ts`: keep only signature verification + event dispatch (call webhookService functions).

**Risk:** Medium. The event handlers have complex DB interactions. Must preserve exact behavior.

---

## M31: ConferenceRoom.tsx (562 lines → ~400 lines)

**Current structure:**
- Lines 123-179: Active speaker tracking effect
- Lines 221-356: Stats sampling effect (135 lines!) ← TARGET
- Lines 354-446: Various smaller effects + JSX

**Plan:**
1. Create `hooks/useCallHealthMonitor.ts` — extract the 135-line stats sampling effect into a standalone hook.
2. The hook takes `{ room, settingsView, setCallMetrics, setQualityOverride, addDiagnosticsEvent, ... }` and manages its own interval + effect.
3. In `ConferenceRoom.tsx`: replace the inline effect with `useCallHealthMonitor({ ... })`.

**Risk:** Low. Effect extraction is the safest refactor — just moving code to a hook.

---

## M30: roomStore.ts (799 lines) — DOCUMENT ONLY

**Decision:** Do NOT physically split. Zustand store splitting requires `combine` middleware or separate stores with cross-store subscriptions — too risky without extensive integration testing.

**Plan:** Add clear section delimiters with `// ════ SLICE N: Name ════` comments and a file header documenting the slice architecture.

---

## M34: backgroundEffectsManager singleton — DOCUMENT ONLY

**Decision:** Module-level singleton is acceptable for a track processor (only one camera track per participant). Add a comment explaining the design choice.

---

## M36: meetingRoomConfig.ts fallback — DOCUMENT ONLY

**Decision:** The fallback exists for resilience (config file missing/corrupt). Add a comment linking the two sources and warning about keeping them in sync.
