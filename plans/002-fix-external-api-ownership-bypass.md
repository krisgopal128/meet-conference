# Plan 002: Fix external API ownership bypass when room not in DB

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step.
>
> **Drift check**: `git diff --stat baf8943..HEAD -- meet-backend/src/routes/external.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `baf8943`, 2026-06-18

## Why this matters

The external API's `/rooms/:name/end` and `DELETE /rooms/:name` routes check ownership with `if (roomOwner && roomOwner.host_id !== ...)`. When `roomOwner` is null (room exists in LiveKit but not in the local DB — e.g., created directly, or DB row deleted), the ownership check is skipped entirely. Any API key holder can end or delete any LiveKit-only room by name.

## Current state

**File**: `meet-backend/src/routes/external.ts`

Lines 450-455 (POST `/rooms/:name/end`):
```typescript
// Verify ownership
const apiKeyInfo = (req as ExternalApiRequest).apiKey;
const roomOwner = await queryOne<{ host_id: string }>('SELECT host_id FROM rooms WHERE name = $1', [name]);
if (roomOwner && roomOwner.host_id !== apiKeyInfo?.userId) {
  return res.status(403).json({ error: 'Not authorized to modify this room' });
}
```

Lines 494-499 (DELETE `/rooms/:name`) — identical pattern:
```typescript
const roomOwner = await queryOne<{ host_id: string }>('SELECT host_id FROM rooms WHERE name = $1', [name]);
if (roomOwner && roomOwner.host_id !== apiKeyInfo?.userId) {
  return res.status(403).json({ error: 'Not authorized to modify this room' });
}
```

The bug: `roomOwner && ...` skips the entire block when `roomOwner` is null.

## Commands you will need

| Purpose   | Command                                      | Expected on success |
|-----------|----------------------------------------------|---------------------|
| Typecheck | `cd meet-backend && npx tsc --noEmit`        | exit 0              |
| Tests     | `cd meet-backend && npm run test -- --run`   | all pass            |
| Lint      | `cd meet-backend && npm run lint`            | exit 0              |

## Scope

**In scope**:
- `meet-backend/src/routes/external.ts` — both the `/end` (line 453) and `DELETE` (line 497) ownership checks

**Out of scope**:
- Any other route in `external.ts`
- The `RoomServiceClient` instantiation pattern (that's PERF-BE-06, a separate plan)

## Steps

### Step 1: Fix the `/end` route ownership check

In `meet-backend/src/routes/external.ts`, change line 453 from:
```typescript
if (roomOwner && roomOwner.host_id !== apiKeyInfo?.userId) {
```
to:
```typescript
if (!roomOwner || roomOwner.host_id !== apiKeyInfo?.userId) {
```

This makes a null `roomOwner` a 403 (not authorized) instead of skipping the check. A room not in the DB should not be endable via the external API — if it doesn't exist in the DB, the API key owner has no claim to it.

### Step 2: Fix the DELETE route ownership check

Same change at line 497:
```typescript
if (!roomOwner || roomOwner.host_id !== apiKeyInfo?.userId) {
```

**Verify**: `cd meet-backend && npx tsc --noEmit` → exit 0

### Step 3: Add test case

In `meet-backend/src/__tests__/routes/security-authorization.test.ts`, add:

```typescript
it('should reject ending a room not in the database', async () => {
  mockQueryOne.mockResolvedValueOnce(null); // room not in DB

  const response = await request(app)
    .post('/external/rooms/unknown-room/end')
    .set('Authorization', 'Bearer test-api-key');

  expect(response.status).toBe(403);
});
```

**Verify**: `cd meet-backend && npm run test -- --run` → all pass

## Done criteria

- [ ] `cd meet-backend && npx tsc --noEmit` exits 0
- [ ] `cd meet-backend && npm run test -- --run` exits 0
- [ ] `grep -n "roomOwner && roomOwner" meet-backend/src/routes/external.ts` returns no matches
- [ ] `grep -n "!roomOwner || roomOwner" meet-backend/src/routes/external.ts` returns 2 matches

## STOP conditions

- The code at `external.ts:453` or `external.ts:497` doesn't match the excerpts
- The test file's mock structure has changed and `mockQueryOne` is not accessible

## Maintenance notes

- If a legitimate use case emerges for ending LiveKit-only rooms (no DB row), add a separate admin-scope check rather than reverting to the null-skip pattern.
- The same `!roomOwner ||` pattern should be used for any future route that checks room ownership.
