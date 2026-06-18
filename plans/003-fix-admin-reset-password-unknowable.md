# Plan 003: Fix admin reset-password setting unknowable password

> **Executor instructions**: Follow this plan step by step.
>
> **Drift check**: `git diff --stat baf8943..HEAD -- meet-backend/src/routes/prashasakah/users.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `baf8943`, 2026-06-18

## Why this matters

The admin "reset password" endpoint generates a random 32-char hex password, hashes it, writes the hash to the DB, and responds `"The temporary password has been logged for the admin."` But the password is never logged (only `"Temp password generated."` at line 400) and never returned in the response. After this endpoint runs, nobody — not the admin, not the user — knows the password. The user cannot log in until they go through `/auth/forgot-password` independently.

## Current state

**File**: `meet-backend/src/routes/prashasakah/users.ts`

Lines 391-408:
```typescript
router.post('/users/:id/reset-password', adminActionLimiter, requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Generate temporary password
    const tempPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
    logger.info(`[Admin] Password reset for user ${id} by ${req.user?.id}. Temp password generated.`);

    await invalidateCache(`cache:users:detail:${id}`);
    await invalidatePattern('cache:users:*');
    invalidateUserAuth(id);

    res.json({
      message: 'Password reset successfully. The temporary password has been logged for the admin.',
    });
  } catch (error) {
    logger.error('[Admin] Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});
```

## Commands you will need

| Purpose   | Command                                      | Expected on success |
|-----------|----------------------------------------------|---------------------|
| Typecheck | `cd meet-backend && npx tsc --noEmit`        | exit 0              |
| Tests     | `cd meet-backend && npm run test -- --run`   | all pass            |

## Scope

**In scope**:
- `meet-backend/src/routes/prashasakah/users.ts` — the `/users/:id/reset-password` route only

**Out of scope**:
- The forgot-password flow (`routes/auth.ts`) — that's a separate, working mechanism
- Any other admin user route

## Steps

### Step 1: Return the temp password in the response

In `meet-backend/src/routes/prashasakah/users.ts`, change lines 406-408 from:
```typescript
res.json({
  message: 'Password reset successfully. The temporary password has been logged for the admin.',
});
```
to:
```typescript
res.json({
  message: 'Password reset successfully.',
  temporaryPassword: tempPassword,
});
```

This endpoint is already behind `requireAdmin()` (line 391), so only authenticated admins see the response.

**Verify**: `cd meet-backend && npx tsc --noEmit` → exit 0

### Step 2: Log the actual password for audit trail (optional but recommended)

Change line 400 from:
```typescript
logger.info(`[Admin] Password reset for user ${id} by ${req.user?.id}. Temp password generated.`);
```
to:
```typescript
logger.info(`[Admin] Password reset for user ${id} by ${req.user?.id}.`);
```

(Remove the misleading "Temp password generated." — the password is in the response, not the logs. Logging passwords to disk is a security risk; the response body is the correct channel.)

**Verify**: `cd meet-backend && npx tsc --noEmit` → exit 0

## Done criteria

- [ ] `cd meet-backend && npx tsc --noEmit` exits 0
- [ ] `grep -n "temporaryPassword" meet-backend/src/routes/prashasakah/users.ts` returns a match
- [ ] `grep -n "has been logged" meet-backend/src/routes/prashasakah/users.ts` returns no matches

## STOP conditions

- The route at line 391 no longer exists or has been refactored
- `requireAdmin()` middleware is no longer applied to this route

## Maintenance notes

- The temp password is returned in the HTTP response body. The admin panel UI should display it immediately and warn the admin to share it securely.
- Consider triggering the `/auth/forgot-password` email flow instead of inventing a password server-side — that's a future improvement, not this plan.
