# Plan 007: Fix whiteboard auto-save timer leak after unmount

> **Executor instructions**: Follow this plan step by step.
>
> **Drift check**: `git diff --stat baf8943..HEAD -- meet-frontend/src/hooks/useWhiteboardAutoSave.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `baf8943`, 2026-06-18

## Why this matters

The whiteboard auto-save uses a self-rescheduling `setTimeout` (`scheduleSave` calls itself at the end of each timer callback). The cleanup at unmount only clears the current `timerRef.current`, but if the callback is mid-execution (inside the `await saveScene(...)`), it calls `scheduleSave()` again — scheduling a new timer that the cleanup cannot reach. After leaving the room, the timer keeps firing `whiteboardApi.saveScene` every 2 seconds indefinitely against a stale `roomName`, leaking bandwidth and producing phantom writes.

## Current state

**File**: `meet-frontend/src/hooks/useWhiteboardAutoSave.ts`

Lines 88-111:
```typescript
useEffect(() => {
  if (!roomName || !excalidrawReady || !shouldSave) return;

  const scheduleSave = () => {
    timerRef.current = setTimeout(async () => {
      if (!dirtyRef.current) { scheduleSave(); return; }
      const scene = sceneRef.current;
      if (!scene) { scheduleSave(); return; }
      try {
        await whiteboardApi.saveScene(roomName, scene as object[], ...);
        dirtyRef.current = false;
      } catch (err) {
        logger.warn('[Whiteboard] Auto-save failed', { error: err });
      }
      scheduleSave();  // <-- BUG: re-schedules even after cleanup
    }, AUTO_SAVE_MS);
  };
  scheduleSave();

  return () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // BUG: if the callback is currently awaiting saveScene, the scheduleSave()
    // call after the await creates a new timer that this cleanup can't reach.
  };
}, [roomName, excalidrawReady, shouldSave, sceneRef]);
```

## Commands you will need

| Purpose   | Command                                                              | Expected on success |
|-----------|----------------------------------------------------------------------|---------------------|
| Typecheck | `cd meet-frontend && npx tsc --noEmit`                              | exit 0              |
| Tests     | `cd meet-frontend && npm run test -- --run`                         | all pass            |
| Build     | `cd meet-frontend && npm run build`                                 | exit 0              |

## Scope

**In scope**:
- `meet-frontend/src/hooks/useWhiteboardAutoSave.ts` — the `scheduleSave` effect only

**Out of scope**:
- Any other hook or component
- The unmount save-on-exit logic (lines 113-148) — that's a separate mechanism

## Steps

### Step 1: Add a stopped flag to prevent re-scheduling after cleanup

In `meet-frontend/src/hooks/useWhiteboardAutoSave.ts`, add a `stopped` ref at the top of the effect (before `scheduleSave`), and check it before re-scheduling.

Replace lines 88-111 with:

```typescript
useEffect(() => {
  if (!roomName || !excalidrawReady || !shouldSave) return;

  let stopped = false;

  const scheduleSave = () => {
    timerRef.current = setTimeout(async () => {
      if (stopped) return;
      if (!dirtyRef.current) { scheduleSave(); return; }
      const scene = sceneRef.current;
      if (!scene) { scheduleSave(); return; }
      try {
        await whiteboardApi.saveScene(roomName, scene as object[], ((getWhiteboardAPI() as any)?.files || undefined) as Record<string, unknown> | undefined);
        dirtyRef.current = false;
        logger.debug('[Whiteboard] Auto-saved scene');
      } catch (err) {
        logger.warn('[Whiteboard] Auto-save failed', { error: err });
      }
      if (!stopped) scheduleSave();
    }, AUTO_SAVE_MS);
  };
  scheduleSave();

  return () => {
    stopped = true;
    if (timerRef.current) clearTimeout(timerRef.current);
  };
}, [roomName, excalidrawReady, shouldSave, sceneRef]);
```

Key changes:
1. `let stopped = false;` — closure variable, set to `true` in cleanup
2. `if (stopped) return;` at the top of the timer callback — exits immediately if unmounted
3. `if (!stopped) scheduleSave();` at the end — only re-schedules if not stopped

**Verify**: `cd meet-frontend && npx tsc --noEmit` → exit 0

**Verify**: `cd meet-frontend && npm run build` → exit 0

## Done criteria

- [ ] `cd meet-frontend && npx tsc --noEmit` exits 0
- [ ] `cd meet-frontend && npm run test -- --run` exits 0
- [ ] `grep -n "let stopped = false" meet-frontend/src/hooks/useWhiteboardAutoSave.ts` returns a match
- [ ] `grep -n "if (!stopped) scheduleSave" meet-frontend/src/hooks/useWhiteboardAutoSave.ts` returns a match

## STOP conditions

- The effect structure at lines 88-111 doesn't match the excerpt (has been refactored)
- `timerRef` or `dirtyRef` or `sceneRef` are no longer used (variables renamed)

## Maintenance notes

- The `stopped` flag is a closure variable (not a ref) because it's scoped to the effect lifecycle — each effect run gets a fresh `false`. This is the correct pattern for cancelling async work in useEffect cleanup.
- If the save interval is changed from `setTimeout` back to `setInterval` in the future, the `stopped` flag is still needed to prevent the interval callback from firing after unmount.
