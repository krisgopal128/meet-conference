import { useEffect, useRef, useCallback } from 'react';
import { whiteboardApi } from '../services/whiteboardApi';
import { registerWhiteboardSave } from './useMeetingActions';
import logger from '../utils/logger';

const apiBase = import.meta.env.VITE_API_URL || '/api';

const AUTO_SAVE_MS = 2000;

/**
 * Auto-saves the whiteboard scene to the backend every 2 seconds
 * when the scene has changed. Uses a dirty flag instead of
 * JSON.stringify comparison to avoid allocations on unchanged scenes.
 *
 * Also saves on unmount and provides a forceSave ref for useMeetingActions
 * to call before room disconnect.
 */
export function useWhiteboardAutoSave(
  roomName: string | undefined,
  sceneRef: React.RefObject<unknown[]>,
  excalidrawReady: boolean,
  shouldSave: boolean = true,
) {
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomNameRef = useRef(roomName);
  const sceneRefStable = useRef(sceneRef);
  roomNameRef.current = roomName;
  sceneRefStable.current = sceneRef;

  // Mark dirty whenever handleChange writes to sceneRef
  // (called from WhiteboardLayout's handleChange callback)
  useEffect(() => {
    if (!roomName || !excalidrawReady || !shouldSave) return;

    // Expose a setter on the ref so WhiteboardLayout can mark dirty
    (sceneRef as any).__markDirty = () => { dirtyRef.current = true; };
    return () => { delete (sceneRef as any).__markDirty; };
  }, [roomName, excalidrawReady, shouldSave, sceneRef]);

  // Force-save function — used by leaveRoom/endMeeting before disconnect
  const forceSave = useCallback(async () => {
    const rn = roomNameRef.current;
    const scene = sceneRefStable.current.current;
    if (!rn || !scene || !dirtyRef.current) return;
    try {
      await whiteboardApi.saveScene(rn, scene as object[]);
      dirtyRef.current = false;
      logger.debug('[Whiteboard] Force-saved scene before leave');
    } catch (err) {
      logger.warn('[Whiteboard] Force-save failed', { error: err });
    }
  }, []);

  // Expose forceSave on the sceneRef so external code can call it
  useEffect(() => {
    (sceneRef as any).__forceSave = forceSave;
    return () => { delete (sceneRef as any).__forceSave; };
  }, [sceneRef, forceSave]);

  // Register forceSave with the meeting actions module so leaveRoom/endMeeting
  // can trigger a final whiteboard save before disconnecting
  useEffect(() => {
    if (!roomName || !excalidrawReady || !shouldSave) return;
    return registerWhiteboardSave(forceSave);
  }, [roomName, excalidrawReady, shouldSave, forceSave]);

  useEffect(() => {
    if (!roomName || !excalidrawReady || !shouldSave) return;

    timerRef.current = setInterval(async () => {
      if (!dirtyRef.current) return; // skip if no changes since last save
      const scene = sceneRef.current;
      if (!scene) return;
      try {
        await whiteboardApi.saveScene(roomName, scene as object[]);
        dirtyRef.current = false;
        logger.debug('[Whiteboard] Auto-saved scene');
      } catch (err) {
        logger.warn('[Whiteboard] Auto-save failed', { error: err });
      }
    }, AUTO_SAVE_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomName, excalidrawReady, shouldSave, sceneRef]);

  // Save on unmount — if there are unsaved changes, fire a final save
  useEffect(() => {
    return () => {
      const rn = roomNameRef.current;
      const scene = sceneRefStable.current.current;
      if (!rn || !scene || !dirtyRef.current) return;
      // Use sendBeacon for reliability during page unload
      try {
        const payload = JSON.stringify({ scene });
        const url = `${apiBase}/whiteboard/${encodeURIComponent(rn)}`;
        navigator.sendBeacon?.(url, new Blob([payload], { type: 'application/json' }));
        logger.debug('[Whiteboard] SendBeacon save on unmount');
      } catch {
        // Fallback: best-effort fetch with keepalive
        try {
          const url = `${apiBase}/whiteboard/${encodeURIComponent(rn)}`;
          fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scene }),
            keepalive: true,
          }).catch(() => {});
        } catch {}
      }
    };
  }, []);

  // beforeunload handler — save before tab close/refresh
  useEffect(() => {
    if (!roomName || !shouldSave) return;

    const handleBeforeUnload = () => {
      const scene = sceneRefStable.current.current;
      if (!scene || !dirtyRef.current) return;
      try {
        const url = `${apiBase}/whiteboard/${encodeURIComponent(roomName)}`;
        navigator.sendBeacon?.(url, new Blob([JSON.stringify({ scene })], { type: 'application/json' }));
      } catch {}
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [roomName, shouldSave]);
}
