import { useCallback, useRef, useEffect, type MutableRefObject, type RefObject } from 'react';
import {
  type Room,
  type LocalParticipant,
  RoomEvent,
} from 'livekit-client';
import type { ExcalidrawImperativeAPI, BinaryFileData } from '@excalidraw/excalidraw/types';
import { publishMessage, ChunkReassembler } from '../utils/livekitData';
import logger from '../utils/logger';

const THROTTLE_MS = 80;
const VIEWPORT_THROTTLE_MS = 200;
const WHITEBOARD_TOPIC = 'whiteboard';

// Message types sent via data channel
export interface WhiteboardDrawMsg {
  type: 'whiteboard-update';
  commit: number;
  elements: unknown[];
  files?: Record<string, unknown>;
}

export interface WhiteboardLockMsg {
  type: 'whiteboard-lock';
  locked: boolean;
}

export interface WhiteboardActivateMsg {
  type: 'whiteboard-activate';
  active: boolean;
}

/** Broadcast by each participant to share their current viewport bounds */
export interface WhiteboardViewportMsg {
  type: 'whiteboard-viewport';
  /** Participant identity sending this viewport */
  identity: string;
  /** Normalized viewport rectangle (0-1 range relative to full canvas) */
  viewport: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type WhiteboardMessage =
  | WhiteboardDrawMsg
  | WhiteboardLockMsg
  | WhiteboardActivateMsg
  | WhiteboardViewportMsg;

/** Map of participant identity → their viewport rectangle */
export type ParticipantViewports = Record<string, { x: number; y: number; width: number; height: number }>;

/**
 * Returns true when the current viewport already shows all of the given
 * elements' bounding box (so no auto-fit is needed).
 */
function viewportContainsElements(api: ExcalidrawImperativeAPI, elements: unknown[]): boolean {
  try {
    const { scrollX, scrollY, zoom, width, height } = api.getAppState();
    const zoomValue = typeof zoom === 'object' ? zoom.value : zoom;
    const viewLeft = -scrollX / zoomValue;
    const viewTop = -scrollY / zoomValue;
    const viewRight = viewLeft + width / zoomValue;
    const viewBottom = viewTop + height / zoomValue;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements as Array<{ x: number; y: number; width?: number; height?: number }>) {
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      if (el.x + (el.width || 0) > maxX) maxX = el.x + (el.width || 0);
      if (el.y + (el.height || 0) > maxY) maxY = el.y + (el.height || 0);
    }
    if (!Number.isFinite(minX)) return true;

    return minX >= viewLeft && minY >= viewTop && maxX <= viewRight && maxY <= viewBottom;
  } catch {
    return true; // Can't determine viewport — leave it alone
  }
}

/**
 * Hook for real-time whiteboard sync via LiveKit data channels.
 * Handles drawing updates, lock/unlock broadcasts, and viewport sharing.
 */
export function useWhiteboardSync(
  room: Room | null,
  localParticipant: LocalParticipant | null,
  excalidrawAPIRef: RefObject<ExcalidrawImperativeAPI | null>,
  /** Set to the last remotely-applied elements array; handleChange skips re-broadcasting while the scene still matches it */
  remoteAppliedRef: MutableRefObject<readonly unknown[] | null>,
  onSceneUpdate?: () => void,
  onSceneElements?: (elements: unknown[]) => void,
) {
  const commitRef = useRef(0);
  const lastBroadcastRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingElements = useRef<readonly unknown[]>([]);
  const lastViewportBroadcast = useRef(0);
  const sentFileIds = useRef<Set<string>>(new Set());
  const reassembler = useRef(new ChunkReassembler());

  // Store frequently-changing values in refs so the DataReceived effect
  // doesn't re-subscribe on every state change (was dropping messages)
  const localParticipantRef = useRef(localParticipant);
  localParticipantRef.current = localParticipant;
  const onSceneUpdateRef = useRef(onSceneUpdate);
  onSceneUpdateRef.current = onSceneUpdate;
  const onSceneElementsRef = useRef(onSceneElements);
  onSceneElementsRef.current = onSceneElements;

  function getNewFiles(): Record<string, unknown> | undefined {
    const allFiles = ((excalidrawAPIRef.current as any)?.files || undefined) as Record<string, unknown> | undefined;
    if (!allFiles) return undefined;
    const newFiles: Record<string, unknown> = {};
    for (const [id, file] of Object.entries(allFiles)) {
      if (!sentFileIds.current.has(id)) {
        newFiles[id] = file;
      }
    }
    return Object.keys(newFiles).length > 0 ? newFiles : undefined;
  }

  function markFilesSent(files: Record<string, unknown> | undefined) {
    if (!files) return;
    for (const id of Object.keys(files)) {
      sentFileIds.current.add(id);
    }
  }

  // Broadcast drawing changes with throttle
  const broadcastChange = useCallback(
    (elements: readonly unknown[]) => {
      if (!room || !localParticipant) return;

      pendingElements.current = elements;

      const now = Date.now();
      const elapsed = now - lastBroadcastRef.current;

      if (elapsed >= THROTTLE_MS) {
        const newFiles = getNewFiles();
        commitRef.current += 1;
        const msg: WhiteboardDrawMsg = {
          type: 'whiteboard-update',
          commit: commitRef.current,
          elements: [...elements],
          files: newFiles,
        };
        publishMessage(room.localParticipant, msg, { topic: WHITEBOARD_TOPIC });
        markFilesSent(newFiles);
        lastBroadcastRef.current = now;
      } else if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          const deferredNewFiles = getNewFiles();
          commitRef.current += 1;
          const msg: WhiteboardDrawMsg = {
            type: 'whiteboard-update',
            commit: commitRef.current,
            elements: [...pendingElements.current],
            files: deferredNewFiles,
          };
          publishMessage(room.localParticipant, msg, { topic: WHITEBOARD_TOPIC });
          markFilesSent(deferredNewFiles);
          lastBroadcastRef.current = Date.now();
          timerRef.current = null;
        }, THROTTLE_MS - elapsed);
      }
    },
    [room, localParticipant],
  );

  // Broadcast lock/unlock change (immediate, no throttle)
  const broadcastLock = useCallback(
    (locked: boolean) => {
      if (!room || !localParticipant) return;

      const msg: WhiteboardLockMsg = { type: 'whiteboard-lock', locked };
      publishMessage(room.localParticipant, msg, { topic: WHITEBOARD_TOPIC });
    },
    [room, localParticipant],
  );

  // Broadcast whiteboard activate/deactivate (immediate, no throttle)
  const broadcastActivate = useCallback(
    (active: boolean) => {
      if (!room || !localParticipant) return;

      const msg: WhiteboardActivateMsg = { type: 'whiteboard-activate', active };
      publishMessage(room.localParticipant, msg, { topic: WHITEBOARD_TOPIC });
    },
    [room, localParticipant],
  );

  /** Broadcast current viewport bounds (throttled, used by all participants) */
  const broadcastViewport = useCallback(
    (viewport: { x: number; y: number; width: number; height: number }) => {
      if (!room || !localParticipant) return;

      const now = Date.now();
      if (now - lastViewportBroadcast.current < VIEWPORT_THROTTLE_MS) return;
      lastViewportBroadcast.current = now;

      const msg: WhiteboardViewportMsg = {
        type: 'whiteboard-viewport',
        identity: localParticipant.identity,
        viewport,
      };
      publishMessage(room.localParticipant, msg, { topic: WHITEBOARD_TOPIC });
    },
    [room, localParticipant],
  );

  // Subscribe to incoming remote drawing updates + lock + viewport messages
  useEffect(() => {
    if (!room) return;

    const onDataReceived = (payload: Uint8Array, participant: any) => {
      if (!participant || participant.identity === localParticipantRef.current?.identity) return;
      try {
        const text = new TextDecoder().decode(payload);
        const parsed = JSON.parse(text) as Record<string, unknown>;

        const msg = reassembler.current.reassemble(parsed);
        if (!msg) return;

        const wbMsg = msg as WhiteboardMessage;
        if (wbMsg.type === 'whiteboard-update' && Array.isArray(wbMsg.elements)) {
          const api = excalidrawAPIRef.current;
          if (!api) {
            logger.debug('[WhiteboardSync] Skipping update — API not ready');
            return;
          }
          logger.debug('[WhiteboardSync] Applying remote drawing update', {
            from: participant.identity,
            elements: wbMsg.elements.length,
            commit: wbMsg.commit,
            hasFiles: !!wbMsg.files,
          });
          // updateScene() IGNORES the files field in this Excalidraw version —
          // images must be merged via addFiles() or they never render remotely
          if (wbMsg.files && Object.keys(wbMsg.files).length > 0) {
            api.addFiles(Object.values(wbMsg.files) as BinaryFileData[]);
          }
          // Record the applied elements so WhiteboardLayout's handleChange can
          // recognize the onChange echo from this updateScene() and skip
          // re-broadcasting it (which would ping-pong between editors forever)
          remoteAppliedRef.current = wbMsg.elements;
          api.updateScene({ elements: wbMsg.elements as any[] } as any);
          onSceneElementsRef.current?.(wbMsg.elements as unknown[]);
          onSceneUpdateRef.current?.();

          // Auto-fit only when the new content falls outside the current
          // viewport — fitting on EVERY update would yank the view away from
          // participants who manually panned/zoomed
          if (wbMsg.elements.length > 0 && !viewportContainsElements(api, wbMsg.elements)) {
            api.scrollToContent(wbMsg.elements as any[], {
              fitToContent: true,
              animate: false,
            });
          }
        }
        // Lock, activate, and viewport messages handled by the host component
      } catch {
        // ignore malformed data
      }
    };

    logger.debug('[WhiteboardSync] Subscribing to DataReceived', {
      hasRoom: !!room,
      localIdentity: localParticipantRef.current?.identity,
    });
    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
    // Only re-subscribe when room changes — all other values are read from refs
    // to prevent message loss during unsubscribe/resubscribe cycles
  }, [room]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      reassembler.current.clear();
    };
  }, []);

  return { broadcastChange, broadcastLock, broadcastActivate, broadcastViewport };
}
