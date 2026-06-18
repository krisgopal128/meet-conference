# Plan 006: Fix webhook error swallowing + partial DB writes

> **Executor instructions**: Follow this plan step by step.
>
> **Drift check**: `git diff --stat baf8943..HEAD -- meet-backend/src/routes/webhook.ts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (but ideally after 005 for auth test patterns)
- **Category**: bug
- **Planned at**: commit `baf8943`, 2026-06-18

## Why this matters

The webhook handler catches ALL errors at line 138 and returns 200 regardless. This means if `handleParticipantJoined` fails on its 3rd DB write (out of 6-8 sequential writes), the handler returns 200, LiveKit doesn't retry, and the state is left partially written — Redis has the participant but `meeting_participants` is missing, participant counts are stale, and meeting history drifts.

## Current state

**File**: `meet-backend/src/routes/webhook.ts`

Lines 97-143 — the dispatch and catch:
```typescript
case 'participant_joined': {
  const roomName = event.room?.name;
  const identity = event.participant?.identity;
  if (roomName && identity) {
    await handleParticipantJoined(roomName, identity, event.participant);
  }
  break;
}
// ... other cases ...
} catch (dbError) {
  logger.error('[Webhook] DB error:', dbError);
  // Still return 200 so LiveKit doesn't retry
}

res.status(200).json({ received: true } as WebhookSuccessResponse);
```

The problem: the `catch` block at line 138 swallows ALL errors from ALL handlers. A partial write in `handleParticipantJoined` (which does 6-8 sequential non-transactional writes across Redis + Postgres) returns 200 with no retry.

## Commands you will need

| Purpose   | Command                                      | Expected on success |
|-----------|----------------------------------------------|---------------------|
| Typecheck | `cd meet-backend && npx tsc --noEmit`        | exit 0              |
| Tests     | `cd meet-backend && npm run test -- --run`   | all pass            |

## Scope

**In scope**:
- `meet-backend/src/routes/webhook.ts` — the catch block and response logic

**Out of scope**:
- `meet-backend/src/services/webhookService.ts` — the individual handler implementations (wrapping those in transactions is a separate, larger plan)
- The webhook signature verification (lines 57-95)

## Steps

### Step 1: Distinguish signature errors from handler errors

In `meet-backend/src/routes/webhook.ts`, change the catch block at lines 138-141 to distinguish between different error types:

```typescript
} catch (dbError) {
  logger.error('[Webhook] Handler error:', dbError);
  // Return 500 so LiveKit retries — the handler may have partially written state.
  // LiveKit webhooks are idempotent for most operations (ON CONFLICT DO NOTHING
  // on meeting creation, check-then-update on participant counts), so a retry
  // will complete the missing writes without duplicating data.
  res.status(500).json({ error: 'Webhook handler failed' } as WebhookErrorResponse);
  return;
}
```

**Important**: This change makes LiveKit retry failed webhooks. The existing handler code in `webhookService.ts` already uses `ON CONFLICT DO NOTHING` for meeting creation (line ~213) and `INSERT ... ON CONFLICT DO NOTHING` for meeting participants, so retries are idempotent. However, verify this by reading `webhookService.ts` lines 147-223 and confirming the upsert patterns.

**Verify**: `cd meet-backend && npx tsc --noEmit` → exit 0

### Step 2: Move the `res.status(200)` to only fire on success

After the catch block, the `res.status(200)` at line 143 should only execute if no error was thrown. With the `return` in the catch block (Step 1), this is now the case — the 200 only fires when all handlers complete successfully.

**Verify**: Read the final flow — signature verify → dispatch → catch (500+return) → 200. Confirm no path reaches the 200 after a handler error.

### Step 3: Add structured error logging

Add the error type to the log:

```typescript
logger.error('[Webhook] Handler error:', {
  error: dbError instanceof Error ? dbError.message : String(dbError),
  stack: dbError instanceof Error ? dbError.stack : undefined,
  eventType: event.event,
  room: event.room?.name,
  participant: event.participant?.identity,
});
```

**Verify**: `cd meet-backend && npx tsc --noEmit` → exit 0

## Done criteria

- [ ] `cd meet-backend && npx tsc --noEmit` exits 0
- [ ] `grep -n "Still return 200" meet-backend/src/routes/webhook.ts` returns no matches
- [ ] `grep -n "status(500)" meet-backend/src/routes/webhook.ts` returns a match in the catch block
- [ ] The catch block has a `return` after `res.status(500)`

## STOP conditions

- `webhookService.ts` does NOT use idempotent writes (`ON CONFLICT DO NOTHING`) — retrying would duplicate data. If so, STOP and report; the fix needs to wrap handlers in transactions first.
- The webhook route has been refactored to a different structure

## Maintenance notes

- This change relies on webhook handler idempotency. If a future handler writes non-idempotently (e.g., `INSERT` without `ON CONFLICT`), it will duplicate on retry. Always use upsert patterns in webhook handlers.
- LiveKit retries webhooks with exponential backoff (typically 3 attempts). A persistent DB failure will still eventually return 200 after retries are exhausted (LiveKit gives up).
- The structured logging added in Step 3 makes it possible to alert on webhook handler failures in production monitoring.
