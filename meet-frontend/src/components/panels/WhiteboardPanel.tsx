/**
 * WhiteboardPanel - Shared digital canvas for real-time collaboration
 *
 * Embedded Excalidraw side panel matching the ChatPanel layout pattern.
 * Syncs drawing changes via LiveKit data channels.
 * Moderator/admin can lock editing; participants see view-only mode.
 * Locked by default — only moderator can toggle.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { useWhiteboardOpen, useUIActions, useIsModerator } from '../../store/roomStore';
import { useWhiteboardSync, type WhiteboardMessage } from '../../hooks/useWhiteboardSync';
import { useWhiteboardAutoSave } from '../../hooks/useWhiteboardAutoSave';
import { whiteboardApi } from '../../services/whiteboardApi';
import type { Room } from 'livekit-client';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import logger from '../../utils/logger';

// Import Excalidraw CSS (required for rendering)
import '@excalidraw/excalidraw/index.css';

// Lazy-import Excalidraw component
const Excalidraw = React.lazy(() =>
  import('@excalidraw/excalidraw').then((mod) => ({ default: mod.Excalidraw })),
);

interface WhiteboardPanelProps {
  room: Room | null;
  roomName?: string;
}

export const WhiteboardPanel = React.memo(function WhiteboardPanel({
  room,
  roomName,
}: WhiteboardPanelProps) {
  const isOpen = useWhiteboardOpen();
  const { toggleWhiteboard } = useUIActions();
  const isModerator = useIsModerator();
  const { localParticipant } = useLocalParticipant();
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [isLocked, setIsLocked] = useState(true); // default locked
  const [, setCurrentScene] = useState<unknown[]>([]);
  const currentSceneRef = useRef<unknown[]>([]);
  const [excalidrawReady, setExcalidrawReady] = useState(false);
  const localIdentity = localParticipant?.identity ?? '';

  // Keep ref in sync with state
  useEffect(() => {
    excalidrawAPIRef.current = excalidrawAPI;
  }, [excalidrawAPI]);

  const { broadcastChange, broadcastLock, loadPersistedScene } = useWhiteboardSync(
    room,
    localParticipant ?? null,
    excalidrawAPIRef,
  );

  // Can edit: moderator always, non-moderator only when unlocked
  const canEdit = isModerator || !isLocked;
  // View-only: non-moderator AND locked
  const isViewOnly = !isModerator && isLocked;

  // Auto-save scene to backend every 2s when changed (any user who can edit)
  useWhiteboardAutoSave(roomName, currentSceneRef, excalidrawReady, canEdit);

  // Load persisted scene + lock state on mount
  useEffect(() => {
    if (!isOpen || !roomName || !excalidrawAPIRef.current) return;
    let cancelled = false;

    loadPersistedScene(roomName).then((state) => {
      if (cancelled) return;
      if (state) {
        setIsLocked(state.locked);
        // Scroll to fit content after loading
        const api = excalidrawAPIRef.current;
        if (api && Array.isArray(state.scene) && state.scene.length > 0) {
          api.scrollToContent(state.scene as any[], {
            fitToContent: true,
            animate: true,
          });
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, roomName, excalidrawAPI, loadPersistedScene]);

  // Subscribe to remote lock messages via LiveKit data channel
  // Drawing updates are handled by useWhiteboardSync internally
  useEffect(() => {
    if (!isOpen || !room) return;

    const onDataReceived = (payload: Uint8Array, participant: any) => {
      if (!participant || participant.identity === localIdentity) return;
      try {
        const text = new TextDecoder().decode(payload);
        const msg = JSON.parse(text) as WhiteboardMessage;
        if (msg.type === 'whiteboard-lock' && typeof msg.locked === 'boolean') {
          setIsLocked(msg.locked);
        }
      } catch {
        // ignore malformed data
      }
    };

    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [isOpen, room, localIdentity]);

  // Handle drawing changes — broadcast and track scene for auto-save
  const handleChange = useCallback(
    (elements: readonly any[]) => {
      setCurrentScene([...elements]);
      currentSceneRef.current = [...elements];
      if (!canEdit) return;
      broadcastChange(elements);
      (currentSceneRef as any).__markDirty?.();
    },
    [broadcastChange, canEdit],
  );

  // Toggle lock (moderator only)
  const handleToggleLock = useCallback(async () => {
    if (!isModerator || !roomName) return;

    const newLocked = !isLocked;
    setIsLocked(newLocked);

    // Persist to backend
    try {
      await whiteboardApi.setLocked(roomName, newLocked);
    } catch (err) {
      logger.warn('[Whiteboard] Failed to persist lock state', { error: err });
    }

    // Broadcast to other participants
    broadcastLock(newLocked);
  }, [isModerator, roomName, isLocked, broadcastLock]);

  const handleAPIRef = useCallback((api: ExcalidrawImperativeAPI) => {
    excalidrawAPIRef.current = api;
    setExcalidrawAPI(api);
    setExcalidrawReady(true);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="w-96 flex flex-col bg-surface-800 border-l border-surface-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-brand-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
            />
          </svg>
          <h2 className="text-sm font-semibold text-surface-100">Whiteboard</h2>
        </div>

        <div className="flex items-center gap-1">
          {/* Lock toggle — only visible to moderators */}
          {isModerator && (
            <button
              onClick={handleToggleLock}
              className={`p-1.5 rounded-lg transition-colors ${
                isLocked
                  ? 'text-yellow-400 hover:bg-yellow-400/10'
                  : 'text-green-400 hover:bg-green-400/10'
              }`}
              title={isLocked ? 'Unlock for editing' : 'Lock (view-only for others)'}
              aria-label={isLocked ? 'Unlock whiteboard' : 'Lock whiteboard'}
            >
              {isLocked ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              )}
            </button>
          )}

          {/* Status badge */}
          {isViewOnly && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 mr-1">
              {isLocked ? 'Locked' : 'View only'}
            </span>
          )}
          {isModerator && !isLocked && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 mr-1">
              Editing
            </span>
          )}

          {/* Close button */}
          <button
            onClick={toggleWhiteboard}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors"
            aria-label="Close whiteboard"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Excalidraw Canvas — fills container via absolute positioning */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <React.Suspense
          fallback={
            <div className="flex items-center justify-center h-full text-surface-400 text-sm">
              Loading whiteboard…
            </div>
          }
        >
          <div className="absolute inset-0" style={{ width: '100%', height: '100%' }}>
            <Excalidraw
              excalidrawAPI={handleAPIRef}
              onChange={handleChange}
              UIOptions={{
                canvasActions: {
                  changeViewBackgroundColor: !isViewOnly,
                  clearCanvas: !isViewOnly,
                  export: { saveFileToDisk: true },
                  loadScene: !isViewOnly,
                  saveToActiveFile: false,
                  toggleTheme: true,
                },
                tools: { image: !isViewOnly },
              }}
              theme="dark"
              gridModeEnabled={false}
              viewModeEnabled={isViewOnly}
              zenModeEnabled={false}
              langCode="en"
              isCollaborating={true}
            />
          </div>
        </React.Suspense>
      </div>
    </div>
  );
});
