import { useEffect, useRef, useCallback } from 'react';
import { whiteboardApi } from '../services/whiteboardApi';
import { registerWhiteboardSave } from './useMeetingActions';
import { useAuthStore } from '../store/authStore';
import { getWhiteboardAPI } from '../services/whiteboardAPIBridge';
import logger from '../utils/logger';

const AUTO_SAVE_MS = 2000;

/**
 * Helper: get auth token from the Zustand store.
 * This works during page unload because we read the store synchronously.
 */
function getAuthToken(): string | null {
  return useAuthStore.getState().token;
}

/**
 * Helper: save whiteboard via fetch with auth headers (works with keepalive).
 * sendBeacon cannot send custom headers, so we always use fetch keepalive
 * for the unmount/beforeunload path.
 */
function saveWithAuth(url: string, scene: unknown[]): void {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  // Read CSRF cookie
  const csrfMatch = document.cookie.match(/csrf_token=([^;]+)/);
  if (csrfMatch) headers['X-CSRF-Token'] = csrfMatch[1];

  fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ scene }),
    keepalive: true,
  }).catch(() => {});
}

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
  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  // Force-save function — used by leaveRoom/endMeeting before disconnect
  const forceSave = useCallback(async () => {
    const rn = roomNameRef.current;
    const scene = sceneRefStable.current.current;
    if (!rn || !scene || !dirtyRef.current) return;
    try {
      await whiteboardApi.saveScene(rn, scene as object[], ((getWhiteboardAPI() as any)?.files || undefined) as Record<string, unknown> | undefined);
      dirtyRef.current = false;
      logger.debug('[Whiteboard] Force-saved scene before leave');
    } catch (err) {
      logger.warn('[Whiteboard] Force-save failed', { error: err });
    }
  }, []);

  // Register forceSave with the meeting actions module so leaveRoom/endMeeting
  // can trigger a final whiteboard save before disconnecting
  useEffect(() => {
    if (!roomName || !excalidrawReady || !shouldSave) return;
    return registerWhiteboardSave(forceSave);
  }, [roomName, excalidrawReady, shouldSave, forceSave]);

  useEffect(() => {
    if (!roomName || !excalidrawReady || !shouldSave) return;

    const scheduleSave = () => {
      timerRef.current = setTimeout(async () => {
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
        scheduleSave();
      }, AUTO_SAVE_MS);
    };
    scheduleSave();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [roomName, excalidrawReady, shouldSave, sceneRef]);

  // Save on unmount — if there are unsaved changes, fire a final save
  // Uses fetch with keepalive + auth headers (sendBeacon can't send headers)
  useEffect(() => {
    return () => {
      const rn = roomNameRef.current;
      const scene = sceneRefStable.current.current;
      if (!rn || !scene || !dirtyRef.current) return;
      try {
        const apiBase = import.meta.env.VITE_API_URL || '/api';
        const url = apiBase + '/whiteboard/' + encodeURIComponent(rn);
        saveWithAuth(url, scene as object[]);
        logger.debug('[Whiteboard] Fetch-keepalive save on unmount');
      } catch {
        // Last resort — nothing we can do if this fails
      }
    };
  }, []);

  // beforeunload handler — save before tab close/refresh
  // Uses fetch with keepalive + auth headers
  useEffect(() => {
    if (!roomName || !shouldSave) return;

    const handleBeforeUnload = () => {
      const scene = sceneRefStable.current.current;
      if (!scene || !dirtyRef.current) return;
      try {
        const apiBase = import.meta.env.VITE_API_URL || '/api';
        const url = apiBase + '/whiteboard/' + encodeURIComponent(roomName);
        saveWithAuth(url, scene as object[]);
      } catch {}
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [roomName, shouldSave]);

  return { markDirty, forceSave };
}
