import { useCallback, useRef, useEffect, type RefObject } from 'react';
import {
  type Room,
  type LocalParticipant,
  RoomEvent,
} from 'livekit-client';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { whiteboardApi } from '../services/whiteboardApi';
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
 * Hook for real-time whiteboard sync via LiveKit data channels.
 * Handles drawing updates, lock/unlock broadcasts, and viewport sharing.
 */
export function useWhiteboardSync(
  room: Room | null,
  localParticipant: LocalParticipant | null,
  excalidrawAPIRef: RefObject<ExcalidrawImperativeAPI | null>,
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

  // Load persisted scene on mount
  const loadPersistedScene = useCallback(
    async (roomName: string) => {
      try {
        const state = await whiteboardApi.getState(roomName);
        if (state && excalidrawAPIRef.current && Array.isArray(state.scene) && state.scene.length > 0) {
          excalidrawAPIRef.current.updateScene({ elements: state.scene as any[], files: state.files as any } as any);
          onSceneElements?.(state.scene as unknown[]);
          onSceneUpdate?.();
        }
        return state;
      } catch (err) {
        logger.warn('[Whiteboard] Failed to load persisted scene', { error: err });
        return null;
      }
    },
    [excalidrawAPIRef, onSceneElements, onSceneUpdate],
  );

  // Subscribe to incoming remote drawing updates + lock + viewport messages
  useEffect(() => {
    if (!room) return;

    const onDataReceived = (payload: Uint8Array, participant: any) => {
      if (!participant || participant.identity === localParticipant?.identity) return;
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
          if (wbMsg.elements.length === 0) {
            logger.debug('[WhiteboardSync] Skipping empty remote update (likely spurious mount event)');
            return;
          }
          logger.debug('[WhiteboardSync] Applying remote drawing update', {
            from: participant.identity,
            elements: wbMsg.elements.length,
            commit: wbMsg.commit,
            hasFiles: !!wbMsg.files,
          });
          api.updateScene({ elements: wbMsg.elements as any[], files: wbMsg.files as any } as any);
          onSceneElements?.(wbMsg.elements as unknown[]);
          onSceneUpdate?.();

          // Google Meet-style: auto-fit viewport to show all content
          // Ensures all participants see the same drawings regardless of screen size
          if (wbMsg.elements.length > 0) {
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
      localIdentity: localParticipant?.identity,
    });
    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [room, excalidrawAPIRef, localParticipant, onSceneElements, onSceneUpdate]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      reassembler.current.clear();
    };
  }, []);

  return { broadcastChange, broadcastLock, broadcastActivate, broadcastViewport, loadPersistedScene };
}
