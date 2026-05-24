import { useEffect, useRef } from 'react';
import { whiteboardApi } from '../services/whiteboardApi';
import logger from '../utils/logger';

const AUTO_SAVE_MS = 2000;

/**
 * Auto-saves the whiteboard scene to the backend every 2 seconds
 * when the scene has changed. Uses a dirty flag instead of
 * JSON.stringify comparison to avoid allocations on unchanged scenes.
 */
export function useWhiteboardAutoSave(
  roomName: string | undefined,
  sceneRef: React.RefObject<unknown[]>,
  excalidrawReady: boolean,
  shouldSave: boolean = true,
) {
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mark dirty whenever handleChange writes to sceneRef
  // (called from WhiteboardLayout's handleChange callback)
  useEffect(() => {
    if (!roomName || !excalidrawReady || !shouldSave) return;

    // Expose a setter on the ref so WhiteboardLayout can mark dirty
    (sceneRef as any).__markDirty = () => { dirtyRef.current = true; };
    return () => { delete (sceneRef as any).__markDirty; };
  }, [roomName, excalidrawReady, shouldSave, sceneRef]);

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
}
