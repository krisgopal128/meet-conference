# Plan 005: Add tests for token refresh, logout, forgot/reset-password

> **Executor instructions**: Follow this plan step by step.
>
> **Drift check**: `git diff --stat baf8943..HEAD -- meet-backend/src/__tests__/routes/auth.test.ts meet-backend/src/routes/auth.ts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 004 (one-command verification — so you can confirm the new tests pass)
- **Category**: tests
- **Planned at**: commit `baf8943`, 2026-06-18

## Why this matters

The auth test file covers only `/register` and `/login`. The security-critical paths — `/refresh` (atomic token rotation + blacklist), `/logout` (token revocation), `/forgot-password` (reset token issuance), `/reset-password` (single-use token redemption) — have zero coverage. A regression in the atomic `UPDATE refresh_tokens SET revoked=true ... RETURNING` guard would silently allow token reuse, and nobody would know until an incident.

## Current state

**File**: `meet-backend/src/__tests__/routes/auth.test.ts`

Lines 1-38 — the test setup mocks DB, Redis, rateLimiter, and config:
```typescript
vi.mock('../../services/database.js', () => ({
  queryOne: vi.fn(),
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock('../../services/redis.js', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
  // ...
}));

vi.mock('../../middleware/rateLimiter.js', () => ({
  authLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
```

The existing tests use `mockQueryOne` and `mockCreateAccessToken` patterns. New tests should follow the same mock conventions.

**File**: `meet-backend/src/routes/auth.ts`

Key flows to test:
- `/refresh` (line ~317): reads refresh token from httpOnly cookie, verifies, does atomic `UPDATE ... SET revoked=true ... RETURNING user_id`, issues new token pair, blacklists old access token
- `/logout` (line ~558): revokes refresh token, blacklists access token, clears cookie
- `/forgot-password` (line ~454): generates reset token, stores in Redis with TTL, (email sending mocked)
- `/reset-password` (line ~500): validates reset token from Redis, hashes new password, deletes token (single-use)

## Commands you will need

| Purpose   | Command                                                               | Expected on success     |
|-----------|-----------------------------------------------------------------------|-------------------------|
| Tests     | `cd meet-backend && npm run test -- --run -- auth.test.ts`           | all pass, including new |
| Typecheck | `cd meet-backend && npx tsc --noEmit`                                | exit 0                  |

## Scope

**In scope**:
- `meet-backend/src/__tests__/routes/auth.test.ts` — add test blocks only

**Out of scope**:
- `meet-backend/src/routes/auth.ts` — no production code changes
- Any other test file

## Steps

### Step 1: Add `/auth/refresh` test block

Add a `describe('POST /auth/refresh', ...)` block to `auth.test.ts`. Test these cases:

```typescript
describe('POST /auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should issue new tokens with valid refresh cookie', async () => {
    // Mock: jwt.verify returns { userId: 'user-1' }
    // Mock: queryOne for refresh token lookup returns a valid row
    // Mock: query for atomic UPDATE ... RETURNING returns { user_id: 'user-1' }
    // Mock: queryOne for user lookup returns user object
    // Assert: response 200, has token + refreshToken cookie
    // Assert: old access token blacklisted (blacklistToken called)
  });

  it('should reject expired refresh token', async () => {
    // No refresh cookie in request
    // Assert: 401
  });

  it('should reject already-revoked refresh token (replay attack)', async () => {
    // Mock: UPDATE ... WHERE revoked = false ... RETURNING returns null (already revoked)
    // Assert: 401
  });
});
```

**Verify**: `cd meet-backend && npm run test -- --run -- -t "refresh"` → 3 tests pass

### Step 2: Add `/auth/logout` test block

```typescript
describe('POST /auth/logout', () => {
  it('should revoke refresh token and blacklist access token', async () => {
    // Mock authenticate middleware to set req.user
    // Mock query for UPDATE refresh_tokens SET revoked = true
    // Assert: response 200
    // Assert: blacklistToken called with the access token
    // Assert: response clears the refreshToken cookie
  });
});
```

**Verify**: `cd meet-backend && npm run test -- --run -- -t "logout"` → passes

### Step 3: Add `/auth/forgot-password` and `/auth/reset-password` test blocks

```typescript
describe('POST /auth/forgot-password', () => {
  it('should store reset token in Redis with TTL', async () => {
    // Mock queryOne to return a user
    // Assert: response 200 (always, even if user not found — security)
    // Assert: cacheSet called with reset token key and TTL
  });
});

describe('POST /auth/reset-password', () => {
  it('should reset password and delete reset token', async () => {
    // Mock cacheGet to return the stored reset token
    // Mock queryOne for user lookup
    // Assert: response 200
    // Assert: query called with UPDATE users SET password_hash
    // Assert: cacheDel called to delete the reset token (single-use)
  });

  it('should reject invalid reset token', async () => {
    // Mock cacheGet to return null
    // Assert: 400 or 401
  });
});
```

**Verify**: `cd meet-backend && npm run test -- --run -- auth.test.ts` → all tests pass

## Done criteria

- [ ] `cd meet-backend && npm run test -- --run -- auth.test.ts` exits 0
- [ ] At least 6 new test cases exist (3 refresh, 1 logout, 1 forgot, 1+ reset)
- [ ] The replay-attack test (revoked token rejected) exists and passes
- [ ] No production files modified (`git status` shows only `auth.test.ts`)

## STOP conditions

- The mock structure at lines 1-38 has changed and the documented mocks don't work
- The auth routes at `/refresh`, `/logout` have been refactored to different paths
- `withTransaction` or `blacklistToken` mocks don't resolve correctly

## Maintenance notes

- These are characterization tests — they pin the current behavior of the auth flows. If the refresh-token rotation logic is refactored later, these tests will catch behavioral regressions.
- The replay-attack test is the single most important security test in the repo — it verifies the atomic `WHERE revoked = false` guard.
