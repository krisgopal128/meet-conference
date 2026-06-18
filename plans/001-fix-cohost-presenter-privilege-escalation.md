# Plan 001: Fix cohost/presenter privilege escalation in token endpoint

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat baf8943..HEAD -- meet-backend/src/routes/token.ts`
> If the file changed since this plan was written, compare excerpts against live code.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `baf8943`, 2026-06-18

## Why this matters

The Zod schema at `token.ts:22` accepts `role: 'cohost'` and `role: 'presenter'`, but lines 74-90 only authorize `'host'` and `'moderator'`. Any authenticated user can POST `{"role":"cohost"}` and receive a LiveKit token with `roomAdmin: true` (see `ROLE_GRANTS.cohost` at `livekit.ts:41-47`), granting full moderator powers — kick, mute, end meeting — in any room. This is a privilege escalation.

## Current state

**File**: `meet-backend/src/routes/token.ts`

Lines 20-26 — the schema accepts all 6 roles without server-side restriction:
```typescript
const requestTokenSchema = z.object({
  roomName: z.string().min(1).max(255),
  role: z.enum(['host', 'cohost', 'moderator', 'presenter', 'attendee', 'viewer']).default('attendee'),
  identity: z.string().min(1).max(255).optional(),
  name: z.string().max(255).optional(),
  ttl: z.number().min(60).max(14400).optional(),
});
```

Lines 73-90 — only `host` and `moderator` are checked. `cohost` and `presenter` pass through unchecked:
```typescript
// If user claims host role, verify they are the host
if (role === 'host' && room && room.host_id !== req.user!.id) {
  return res.status(403).json({ error: 'Only the room creator can be host' });
}

// If user requests moderator role, verify they are host or co-host
if (role === 'moderator' && !isHost && !isModerator) {
  actualRole = 'attendee';
}
// NO CHECK for 'cohost' or 'presenter' — they pass through with full grants
```

**File**: `meet-backend/src/services/livekit.ts`

Lines 41-47 — `cohost` grant includes `roomAdmin: true`:
```typescript
cohost: {
  roomJoin: true,
  canPublish: true,
  canSubscribe: true,
  canPublishData: true,
  roomAdmin: true,
},
```

Lines 55-60 — `presenter` has full publish but no admin:
```typescript
presenter: {
  roomJoin: true,
  canPublish: true,
  canSubscribe: true,
  canPublishData: true,
},
```

## Commands you will need

| Purpose   | Command                                      | Expected on success |
|-----------|----------------------------------------------|---------------------|
| Typecheck | `cd meet-backend && npx tsc --noEmit`        | exit 0, no errors   |
| Tests     | `cd meet-backend && npm run test -- --run`   | all pass            |
| Lint      | `cd meet-backend && npm run lint`            | exit 0              |

## Scope

**In scope**:
- `meet-backend/src/routes/token.ts` — add authorization checks for `cohost` and `presenter`

**Out of scope**:
- `meet-backend/src/services/livekit.ts` — ROLE_GRANTS are correct; the bug is in the authorization gate, not the grants
- `meet-backend/src/routes/external.ts` — external API uses its own role mapping, unaffected
- Frontend — no changes needed; the frontend only sends `'attendee'` or `'moderator'`

## Steps

### Step 1: Add cohost/presenter to the authorization gate

In `meet-backend/src/routes/token.ts`, after the existing `moderator` check (line 90), add:

```typescript
// If user requests cohost role, verify they are host or moderator
if ((role === 'cohost') && !isHost && !isModerator) {
  actualRole = 'attendee';
  logger.info(`[Token] User ${req.user!.id} requested ${role} but not authorized, falling back to attendee`);
}

// presenter is an elevated role — require host or moderator
if (role === 'presenter' && !isHost && !isModerator) {
  actualRole = 'attendee';
  logger.info(`[Token] User ${req.user!.id} requested presenter but not authorized, falling back to attendee`);
}
```

Or more concisely, merge into the existing block by changing line 79 from:
```typescript
if (role === 'moderator' && !isHost && !isModerator) {
```
to:
```typescript
if ((role === 'moderator' || role === 'cohost' || role === 'presenter') && !isHost && !isModerator) {
```

**Verify**: `cd meet-backend && npx tsc --noEmit` → exit 0

### Step 2: Add test case for cohost escalation attempt

In `meet-backend/src/__tests__/routes/token.test.ts`, add a test:

```typescript
it('should downgrade cohost request to attendee for non-host users', async () => {
  mockQueryOne.mockResolvedValueOnce({
    id: 'room-123',
    host_id: 'different-host',
    status: 'active',
    password_hash: null,
    waiting_room_enabled: false,
  });
  mockCreateAccessToken.mockResolvedValueOnce('mock-token');

  const response = await request(app)
    .post('/token')
    .set('Authorization', 'Bearer valid-token')
    .send({ roomName: 'test-room', role: 'cohost' });

  expect(response.status).toBe(200);
  // Verify the token was generated with 'attendee' role, not 'cohost'
  expect(mockCreateAccessToken).toHaveBeenCalledWith(
    expect.objectContaining({ role: 'attendee' })
  );
});
```

**Verify**: `cd meet-backend && npm run test -- --run -- -t "cohost"` → 1 test passes

## Done criteria

- [ ] `cd meet-backend && npx tsc --noEmit` exits 0
- [ ] `cd meet-backend && npm run test -- --run` exits 0; new test passes
- [ ] `grep -n "cohost.*presenter.*!isHost" meet-backend/src/routes/token.ts` returns a match
- [ ] No files outside `token.ts` and `token.test.ts` are modified

## STOP conditions

- The code at `token.ts:73-90` doesn't match the excerpts (codebase has drifted)
- `mockCreateAccessToken` is not mockable in the test file (mock structure has changed)
- The Zod schema at line 22 no longer includes `cohost` or `presenter`

## Maintenance notes

- If a legitimate use case for `cohost`/`presenter` roles emerges (e.g., delegated moderation UI), the authorization logic here is the single gate — extend `isModerator` or add a new permission check rather than removing the gate.
- The ROLE_GRANTS in `livekit.ts` are intentionally powerful; the security boundary is the authorization check in this file, not the grant definition.
