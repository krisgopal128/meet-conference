# Plan 004: Add one-command verification for the entire codebase

> **Executor instructions**: Follow this plan step by step.
>
> **Drift check**: `git diff --stat baf8943..HEAD -- package.json`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `baf8943`, 2026-06-18

## Why this matters

The root `package.json` is `{}` — an empty object. There is no single command that verifies the codebase works. Before any change, an executor must run 6 separate commands across two directories (`typecheck`, `test`, `build` for both frontend and backend) and eyeball results. This is the explicit prerequisite for every other plan — without it, regressions land silently.

## Current state

**File**: `package.json` (root)
```json
{}
```

**File**: `meet-frontend/package.json` defines:
- `"build": "tsc && vite build"`
- `"test": "vitest"`
- `"lint": "eslint src/"`

**File**: `meet-backend/package.json` defines:
- `"build": "tsc"`
- `"test": "vitest"`
- `"lint": "eslint src/"`
- `"typecheck": "tsc --noEmit"`

## Commands you will need

| Purpose   | Command                                              | Expected on success |
|-----------|------------------------------------------------------|---------------------|
| Verify    | `npm run verify` (from repo root, after this plan)  | exit 0, all green   |

## Scope

**In scope**:
- `package.json` (root) — replace `{}` with a workspaces config + verify script

**Out of scope**:
- Any source file changes
- CI config (can be updated separately to call `npm run verify`)

## Steps

### Step 1: Replace root package.json

Replace the contents of `package.json` (root) with:

```json
{
  "name": "meet-conference",
  "private": true,
  "scripts": {
    "verify": "npm run verify -w meet-backend && npm run verify -w meet-frontend",
    "verify:backend": "cd meet-backend && npm run typecheck && npm run lint && npm run test -- --run",
    "verify:frontend": "cd meet-frontend && npx tsc --noEmit && npm run lint && npm run test -- --run && npm run build"
  }
}
```

This avoids npm workspaces complexity (the sub-projects don't reference each other) and uses plain `cd` scripts. `verify` chains both; `verify:backend` and `verify:frontend` can run independently.

**Verify**: `npm run verify:backend` from root → all backend tests pass, typecheck clean

**Verify**: `npm run verify:frontend` from root → all frontend tests pass, build succeeds

## Done criteria

- [ ] `npm run verify:backend` from root exits 0
- [ ] `npm run verify:frontend` from root exits 0
- [ ] Root `package.json` is no longer `{}`
- [ ] No source files modified (`git diff --stat` shows only `package.json`)

## STOP conditions

- `npm run test` in either sub-project fails for reasons unrelated to this plan (pre-existing breakage — report and stop)
- The sub-project `package.json` files have changed their script names

## Maintenance notes

- Once this lands, every future plan's verification section can simply say `npm run verify` instead of listing 6 separate commands.
- If CI is added later, it should call `npm run verify` as its single gate.
