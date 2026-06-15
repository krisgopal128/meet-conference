# Security Audit Report — Meet Conference

**Date**: 2026-06-15
**Scope**: Full codebase audit across 7 dimensions (Auth, Backend Routes, Frontend State, Database, LiveKit, Input Validation, Performance)
**Method**: Parallel subagent analysis with source-level verification

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 11 |
| MEDIUM | 18 |
| LOW | 16 |

**No SQL injection found.** All 80+ query sites use parameterized queries. No `dangerouslySetInnerHTML` in frontend. No XSS vectors. Webhook signature verification is correct. Room isolation is enforced by LiveKit SFU.

---

## CRITICAL Findings

### C1. `password_hash` Leaked in Room API Responses
**File**: `roomService.ts:55,65,112,175,227,240` + `rooms.ts:109,152,215,254`

`SELECT r.*` and `RETURNING *` include the bcrypt `password_hash` column. `res.json()` serializes everything. Any authenticated user calling `GET /rooms?all=true` receives every room's password hash for offline cracking.

**Fix**: Replace `SELECT r.*` / `RETURNING *` with explicit column lists excluding `password_hash`. Where the hash is needed (guest password check), use a dedicated query.

---

### C2. External API Tokens Bypass Waiting Room
**File**: `routes/external.ts:400-408`

External token grants are hardcoded with no `lobbyMode` support:
```typescript
token.addGrant({ room, roomJoin: true, canPublish: ..., canPublishData: true });
```
Regardless of `waiting_room_enabled`, external attendees join immediately, can subscribe to media, and send chat — completely defeating the waiting room.

**Fix**: Check `waiting_room_enabled` and set `canPublish: false, canPublishData: false` when in lobby. Set `metadata: JSON.stringify({ inLobby: true })` for frontend lobby check.

---

### C3. Password Reset Doesn't Invalidate Active Sessions
**File**: `routes/auth.ts:520-528`

After password reset, only the hash is updated. Existing access tokens remain valid for 15 min, refresh tokens for 30 days. An attacker with a stolen session maintains access after the victim resets their password.

**Fix**: After password update, revoke all refresh tokens and invalidate token cache:
```sql
UPDATE refresh_tokens SET revoked = true WHERE user_id = $1
```

---

### C4. External API Identity Collision with Host
**File**: `routes/external.ts:370-372, 553`

The identity collision check is bypassed for elevated roles (`isElevatedRole`). An attacker with a valid API key can generate a moderator token with `identity === roomData.host_id`. Since `participantCanModerate` returns `true` when `identity === roomHostId`, this grants full host privileges.

The teacher-links endpoint (`external.ts:553`) has no collision check at all.

**Fix**: Unconditionally reject external tokens where `identity === roomData.host_id`. Reserve identity prefixes (`guest_`, `teacher-`) and reject non-reserved external identities.

---

## HIGH Findings

### H1. JWT Algorithm Not Pinned
**File**: `middleware/authenticate.ts:201,282` + `routes/auth.ts:310,500`
`jwt.verify()` calls don't specify `algorithms: ['HS256']`. Defense-in-depth gap against algorithm confusion attacks.
**Fix**: Add `algorithms: ['HS256']` to all verify calls.

### H2. External Token TTL Unbounded
**File**: `routes/external.ts:576`
`expires_in` query param has no upper bound. Can request `?expires_in=315360000` (10 years).
**Fix**: `Math.min(parseInt(expires_in) || 86400, 86400)`.

### H3. Whiteboard Read Access — No Authorization
**File**: `routes/whiteboard.ts:14-53`
`GET /whiteboard/:roomName` requires auth but no ownership/participant check. Any user reads any room's whiteboard.
**Fix**: Add same participant/host check used in PUT route.

### H4. API Key Cache Invalidation Mismatch
**File**: `routes/external.ts:131` vs `routes/prashasakah/apiKeys.ts:141,169`
External API caches under `apikey:*`. Admin deactivation invalidates `cache:apikeys:*`. Patterns don't overlap — revoked keys remain valid for 60 seconds.
**Fix**: Invalidate both patterns on deactivation.

### H5. Missing `adminActionLimiter` on Critical Endpoints
**File**: `prashasakah/users.ts:190,383,407` + `config.ts:87` + `settings.ts:45`
Role changes, password resets, system config changes lack strict rate limiting (only generic 500 req/min limiter).
**Fix**: Add `adminActionLimiter` (20 actions/hour).

### H6. Attendee Can Bypass Screen Share Restriction
**File**: `services/livekit.ts:58-63`
Attendee/presenter grants don't set `canPublishSources`. Empty = all sources allowed. The `participantsCanShareScreen=false` setting is only enforced client-side (UI toggle). Bypass via console: `localParticipant.setScreenShareEnabled(true)`.
**Fix**: Use `roomService.updateParticipant()` to set `canPublishSources` excluding screen share when disabled.

### H7. Moderator Can Kick the Host
**File**: `routes/roomsParticipants.ts:51-74`
Kick endpoint verifies requester is moderator but never checks target's role. A cohost can kick the actual host.
**Fix**: Reject if `isModeratorParticipant(target, room.host_id)` unless requester is host.

### H8. Data Channel Flooding (No Rate Limiting)
**File**: `hooks/useDataChannelHandler.tsx:54-190`
No per-sender message cap. Attacker sends 100 msg/s, flooding all clients' UIs with chat/typing/poll spam.
**Fix**: Track message timestamps per `senderIdentity`, drop messages exceeding 10/s.

### H9. Cookie Secure Flag Bypass
**File**: `routes/auth.ts:49-55`
`reqProtocol()` reads `X-Forwarded-Proto` header directly. Attacker sends `X-Forwarded-Proto: http` over HTTPS → refresh cookie set without `Secure` flag → interceptable on subsequent HTTP.
**Fix**: Use `req.protocol` (respects `trust proxy` setting).

### H10. Rate Limiter IP Validation Disabled
**File**: `middleware/rateLimiter.ts:10`
`validate: false` + `trust proxy: 1` = attacker rotates `X-Forwarded-For` to bypass all rate limits.
**Fix**: Strip client-provided `X-Forwarded-For` at proxy, or use `req.socket.remoteAddress`.

### H11. Unbounded `seenFiles` Map in Whiteboard Sync
**File**: `hooks/useWhiteboardSync.ts:73`
`seenFiles` Map grows for entire room session. Every pasted image's dataURL prefix is stored permanently.
**Fix**: LRU cap (keep last 100 entries).

---

## MEDIUM Findings

### M1. Role Derived from Client-Controlled sessionStorage
**File**: `pages/RoomPage.tsx:601-605, 834`
`role` and `hostId` come from sessionStorage (client-writable). Drives `useIsModerator()` for UI gating. Spoofable via `sessionStorage.setItem('role_room', 'host')`.
**Fix**: Decode role from JWT metadata (same pattern as `inLobby` fix).

### M2. Private Moderator Chat Broadcast to All
**File**: `components/panels/ChatPanel.tsx:428` + `hooks/useDataChannelHandler.tsx:89`
"Private to moderators" messages are broadcast to ALL participants via `publishData`. Filtered client-side by `isModerator`. Combined with M1, spoofable.
**Fix**: Use LiveKit `publishData({ destinationIdentities: [...moderators] })`.

### M3. Whiteboard Lock Broadcast — No Privilege Check
**File**: `components/room/WhiteboardLayout.tsx:225-233`
Any participant broadcasts `whiteboard-lock` → everyone honors it. Unlike `whiteboard-activate` (which checks `isPrivilegedSender`), this message has no sender check.
**Fix**: Add `isPrivilegedSender` check or route through `useDataChannelHandler`.

### M4. External API — Missing Ownership Check on Room Read
**File**: `routes/external.ts:286-313`
`GET /external/rooms/:name` doesn't verify `roomData.host_id === apiKeyInfo.userId`. Other external endpoints do.
**Fix**: Add same ownership check.

### M5. No Database Transactions
**File**: `services/database.ts` (no transaction support)
Multi-step operations (user registration, room creation, meeting end) are non-atomic. Partial failures leave orphaned records.
**Fix**: Add `withTransaction(fn)` helper.

### M6. No CHECK Constraints on Enum Columns
**File**: `db/schema.sql`
`users.role`, `rooms.status`, `meetings.status`, etc. have no DB-level CHECK. Invalid values insertable via webhook or future migration.
**Fix**: `ALTER TABLE ... ADD CONSTRAINT ... CHECK (col IN (...))`.

### M7. Missing ON DELETE on Audit/Ban Foreign Keys
**File**: `db/schema.sql:177,20`
`admin_audit_logs.admin_id` and `users.banned_by` have no `ON DELETE` behavior. Deleting a user with audit logs or ban history fails.
**Fix**: `ON DELETE SET NULL`.

### M8. Unauthenticated Diagnostics Upload
**File**: `routes/meetings.ts:113-161`
`optionalAuth` + 500 req/min + 1MB per file = disk exhaustion vector.
**Fix**: Require auth, add strict rate limiter.

### M9. Guest Room Password — No Brute-Force Protection
**File**: `routes/token.ts:143-236`
Room passwords checkable at 30 attempts/min per IP. No lockout (unlike user login).
**Fix**: Per-room password attempt tracking in Redis.

### M10. External API `meeting_ended` Data Channel — Forgeable
**File**: `hooks/useDataChannelHandler.tsx:76-79`
Any moderator can broadcast `meeting_ended` via data channel, ending meeting for all. No server-side validation.
**Fix**: Only process `meeting_ended` from server (not peer-to-peer).

### M11. Error Handler Leaks `err.message` in Non-Production
**File**: `index.ts:167`
If `NODE_ENV` is misconfigured, internal errors (SQL, stack traces) leak to clients.
**Fix**: Always return generic message; log details server-side.

### M12. External Health Endpoint Exposes LiveKit URL
**File**: `routes/external.ts:200-208`
Unauthenticated `/external/health` returns internal LiveKit server URL.
**Fix**: Return only `status: 'ok'`.

### M13. CORS Allows Null Origin
**File**: `index.ts:60-68`
`if (!origin) return callback(null, true)` — non-browser clients bypass CORS with credentials.
**Fix**: Require Origin header for credentialed requests.

### M14. External Token Metadata Client-Controlled
**File**: `routes/external.ts:385-393`
Client-provided `metadata` spread into JWT. Can inject `inLobby: false`, `guest: false`, etc.
**Fix**: Whitelist metadata fields.

### M15. External API Grant Drift from Internal ROLE_GRANTS
**File**: `routes/external.ts:384-408`
External constructs grants inline instead of using shared `createAccessToken()`. Observer gets `canPublishData: true` (internal viewer gets `false`).
**Fix**: Resolve TODO — refactor to use `createAccessToken()`.

### M16. Individual Mute Has No Target Role Protection
**File**: `routes/roomsParticipants.ts:77-90`
Moderator can mute/disable camera of the host or another moderator. `mute-all` correctly skips moderators, but individual mute doesn't.
**Fix**: Check `isModeratorParticipant(target, room.host_id)`.

### M17. Admin Alerts `limit` Unclamped
**File**: `routes/prashasakah/alerts.ts:40`
`?limit=1000000` loads entire table. Other admin endpoints clamp at 200.
**Fix**: `Math.min(Number(req.query.limit) || 20, 200)`.

### M18. Zod Validation Gaps
**Files**: `routes/auth.ts:438,484`, `prashasakah/users.ts:193,267,410`, `routes/external.ts:528`
Forgot-password, reset-password, admin user PATCH, external links params lack Zod schemas.
**Fix**: Add Zod schemas matching existing patterns.

---

## LOW Findings

| # | File | Issue |
|---|------|-------|
| L1 | `authenticate.ts:52` | Token cache 60s TTL — banned users retain access briefly |
| L2 | `auth.ts:458` | Password reset token uses same JWT secret as access tokens |
| L3 | `token.ts:25` | Regular token TTL allows 24h (guest is 1h) |
| L4 | `auth.ts:123` | Expired refresh tokens never cleaned up |
| L5 | `rooms.ts:411` | Room settings publicly readable (meetingLocked, etc.) |
| L6 | `external.ts:419` | `join_url` uses `#token=` but frontend expects `#t=` |
| L7 | `config.ts:35` | `DATABASE_REJECT_UNAUTHORIZED=false` disables SSL verification |
| L8 | `schema.sql:96` | `scheduled_meetings.room_name` has no FK to rooms |
| L9 | `webhookService.ts:321` | Egress webhook lacks structured Zod validation |
| L10 | `csrf.ts:16` | CSRF skip on `/token` allows guest token generation via CSRF |
| L11 | `external.ts:37` | External API metadata accepts arbitrary-size JSON |
| L12 | `livekit.ts:64-69` | Viewer role subscribes to all media (privacy note) |
| L13 | `livekit.ts:28-70` | `canUpdateMetadata` must never be true (fragile invariant) |
| L14 | `participantPresence.ts:71` | Kick cooldown only 10 seconds |
| L15 | `redis.ts:314` | Participant set has no TTL fallback if webhook missed |
| L16 | `redis.ts:254` | `cacheSetMulti` permits TTL-less keys (dormant) |

---

## Verified Secure (No Issues Found)

- **SQL injection**: All 80+ queries use parameterized `$1, $2` pattern
- **XSS**: No `dangerouslySetInnerHTML` anywhere; chat sanitized via `sanitizeDisplayText`
- **Auth token storage**: JWT only in memory (not persisted); refresh via httpOnly cookie
- **Webhook signature**: `WebhookReceiver.receive(rawBody, authHeader)` verified
- **Room isolation**: Enforced by LiveKit SFU at infrastructure level
- **Guest identity**: `crypto.randomBytes(16)` — 128 bits of CSPRNG
- **Password hashing**: bcrypt cost 12
- **Refresh token rotation**: Atomic conditional UPDATE prevents replay
- **Event listener cleanup**: All hooks properly clean up in useEffect returns
- **AudioContext/Canvas/Worker disposal**: All properly disposed
- **Chat message pruning**: Capped at 500
- **Bundle splitting**: Thoughtful manualChunks configuration
- **Admin route protection**: All require `requireModerator()` or `requireAdmin()`
- **Recording authorization**: Start/stop verified against host_id
- **API key CRUD**: All queries include `WHERE user_id = $1`

---

## Recommended Fix Priority

1. **C1** — password_hash leakage (trivial fix, critical impact)
2. **C4** — external identity collision (host impersonation)
3. **C2** — external lobby bypass
4. **H9** — cookie secure flag bypass
5. **H10** — rate limiter bypass via X-Forwarded-For
6. **C3** — password reset session invalidation
7. **H7** — moderator can kick host
8. **H6** — screen share bypass
9. **H3** — whiteboard unauthorized read
10. **M1+M2+M3** — frontend trust boundary (derive role from JWT)
