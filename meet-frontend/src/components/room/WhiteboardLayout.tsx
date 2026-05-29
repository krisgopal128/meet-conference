/**
 * WhiteboardLayout — Full-screen whiteboard with floating participant panel
 *
 * Fullscreen flow:
 *   1. User clicks fullscreen button
 *   2. Whiteboard container enters browser Fullscreen API (fills entire screen)
 *   3. A floating participant panel appears on the right side INSIDE fullscreen
 *   4. Exiting fullscreen (button, Escape key) restores normal layout
 */

import React, { useState, useCallback, useEffect, useRef, useMemo, Suspense, } from 'react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import type { Room } from 'livekit-client';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
  useUIActions,
  useIsModerator,
  useWhiteboardFullscreen,
} from '../../store/roomStore';
import {
  useWhiteboardSync,
  type WhiteboardMessage,
  type ParticipantViewports,
} from '../../hooks/useWhiteboardSync';
import { useWhiteboardAutoSave } from '../../hooks/useWhiteboardAutoSave';
import { whiteboardApi } from '../../services/whiteboardApi';
import { ParticipantTile } from './ParticipantTile';
import { FloatingParticipantPanel } from './FloatingParticipantPanel';
import { useAdmittedParticipants } from '../../hooks/useAdmittedParticipants';
import logger from '../../utils/logger';

import '@excalidraw/excalidraw/index.css';

const Excalidraw = React.lazy(() =>
  import('@excalidraw/excalidraw').then((mod) => ({ default: mod.Excalidraw })),
);

interface WhiteboardLayoutProps {
  room: Room | null;
  roomName?: string;
}

const FILMSTRIP_HEIGHT = 119;

export function WhiteboardLayout({ room, roomName }: WhiteboardLayoutProps) {
  const { toggleWhiteboard, setWhiteboardFullscreen } = useUIActions();
  const isModerator = useIsModerator();
  const isFullscreen = useWhiteboardFullscreen();
  const { localParticipant } = useLocalParticipant();
  const allParticipants = useParticipants();
  const localIdentity = localParticipant?.identity ?? '';

  const admittedParticipants = useAdmittedParticipants(allParticipants, localIdentity);

  // Ref for the container that goes browser-fullscreen
  const whiteboardContainerRef = useRef<HTMLDivElement>(null);

  // Refs — avoid state changes that trigger Excalidraw re-renders
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const currentSceneRef = useRef<unknown[]>([]);

  const [isLocked, setIsLocked] = useState(true);
  const [excalidrawReady, setExcalidrawReady] = useState(false);

  // Track what each participant is viewing on the canvas
  const [participantViewports, setParticipantViewports] = useState<ParticipantViewports>({});

  // Single whiteboard sync hook — handles broadcast + receive
  const { broadcastChange, broadcastLock, broadcastActivate, broadcastViewport } = useWhiteboardSync(
    room,
    localParticipant ?? null,
    excalidrawAPIRef,
  );

  const isViewOnly = !isModerator && isLocked;
  const canEdit = isModerator || !isLocked;
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;

  // Auto-save via polling — only moderators save
  useWhiteboardAutoSave(
    roomName,
    currentSceneRef,
    excalidrawReady,
    isModerator,
  );

  // Load persisted scene once when API is ready
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!roomName || !excalidrawAPIRef.current || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    whiteboardApi.getState(roomName).then((state) => {
      if (state) {
        setIsLocked(state.locked);
        if (excalidrawAPIRef.current && Array.isArray(state.scene) && state.scene.length > 0) {
          excalidrawAPIRef.current.updateScene({ elements: state.scene as any[] });
          excalidrawAPIRef.current.scrollToContent(state.scene as any[], {
            fitToContent: true,
            animate: true,
          });
          logger.debug('[Whiteboard] Loaded persisted scene', { elements: state.scene.length });
        }
      }
    }).catch((err) => {
      logger.warn('[Whiteboard] Failed to load persisted scene', { error: err });
    });
  }, [roomName]);

  // Subscribe to remote lock messages + viewport messages
  useEffect(() => {
    if (!room) return;

    const onDataReceived = (payload: Uint8Array, participant: any) => {
      if (!participant || participant.identity === localIdentity) return;
      try {
        const text = new TextDecoder().decode(payload);
        const msg = JSON.parse(text) as WhiteboardMessage;

        if (msg.type === 'whiteboard-lock') {
          setIsLocked(msg.locked);
        }

        // Track participant viewports for the viewport indicator overlay
        if (msg.type === 'whiteboard-viewport') {
          setParticipantViewports((prev) => ({
            ...prev,
            [msg.identity]: msg.viewport,
          }));
        }
      } catch {
        // ignore malformed data
      }
    };

    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [room, localIdentity]);

  // Broadcast local viewport periodically when canvas scrolls/zooms
  useEffect(() => {
    const api = excalidrawAPIRef.current;
    if (!api || !room) return;

    const broadcastLocalViewport = () => {
      try {
        const appState = api.getAppState();
        const { scrollX, scrollY, zoom, width, height } = appState;
        const zoomValue = typeof zoom === 'object' ? zoom.value : zoom;

        const viewX = -scrollX / zoomValue;
        const viewY = -scrollY / zoomValue;
        const viewW = width / zoomValue;
        const viewH = height / zoomValue;

        const elements = api.getSceneElements();
        if (elements.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const el of elements) {
          if (el.x < minX) minX = el.x;
          if (el.y < minY) minY = el.y;
          const elRight = el.x + (el.width || 0);
          const elBottom = el.y + (el.height || 0);
          if (elRight > maxX) maxX = elRight;
          if (elBottom > maxY) maxY = elBottom;
        }

        const sceneW = maxX - minX || 1;
        const sceneH = maxY - minY || 1;

        broadcastViewport({
          x: (viewX - minX) / sceneW,
          y: (viewY - minY) / sceneH,
          width: viewW / sceneW,
          height: viewH / sceneH,
        });
      } catch {
        // ignore
      }
    };

    const interval = setInterval(broadcastLocalViewport, 500);
    return () => clearInterval(interval);
  }, [room, excalidrawReady, broadcastViewport]);

  // Listen for browser fullscreen change events (Escape key, browser UI exit)
  useEffect(() => {
    const container = whiteboardContainerRef.current;
    if (!container) return;

    const handleFullscreenChange = () => {
      const isNowFullscreen = document.fullscreenElement === container;
      if (!isNowFullscreen && isFullscreen) {
        // User exited fullscreen (Escape key, browser UI) — sync state
        setWhiteboardFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen, setWhiteboardFullscreen]);

  // Handle Excalidraw API ref
  const handleAPIRef = useCallback((api: ExcalidrawImperativeAPI) => {
    excalidrawAPIRef.current = api;
    setExcalidrawReady(true);
  }, []);

  // Handle drawing changes — broadcast if user can edit
  const handleChange = useCallback(
    (elements: readonly any[]) => {
      currentSceneRef.current = [...elements];
      if (canEditRef.current) {
        broadcastChange(elements);
        (currentSceneRef as any).__markDirty?.();
      }
    },
    [broadcastChange],
  );

  const handleToggleLock = useCallback(async () => {
    const next = !isLocked;
    setIsLocked(next);
    broadcastLock(next);
    if (roomName) {
      try {
        await whiteboardApi.setLocked(roomName, next);
      } catch (err) {
        logger.warn('[Whiteboard] Failed to persist lock state', { error: err });
      }
    }
  }, [isLocked, broadcastLock, roomName]);

  // Fullscreen toggle — uses browser Fullscreen API
  // Participants are shown in a floating overlay INSIDE the fullscreen element
  // (Document PiP API conflicts with requestFullscreen for user activation)
  const handleFullscreenToggle = useCallback(async () => {
    const container = whiteboardContainerRef.current;
    if (!container || !isModerator) return;

    if (!isFullscreen) {
      try {
        await container.requestFullscreen();
        setWhiteboardFullscreen(true);
      } catch (err) {
        logger.warn('[Whiteboard] Fullscreen request failed:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch (err) {
        logger.warn('[Whiteboard] Exit fullscreen failed:', err);
      }
      setWhiteboardFullscreen(false);
    }
  }, [isFullscreen, isModerator, setWhiteboardFullscreen]);

  // Generate viewport indicator boxes for the overlay
  const viewportIndicators = useMemo(() => {
    return Object.entries(participantViewports).map(([identity, vp]) => ({
      identity,
      style: {
        left: `${Math.max(0, Math.min(100, vp.x * 100))}%`,
        top: `${Math.max(0, Math.min(100, vp.y * 100))}%`,
        width: `${Math.max(2, Math.min(100, vp.width * 100))}%`,
        height: `${Math.max(2, Math.min(100, vp.height * 100))}%`,
      },
    }));
  }, [participantViewports]);

  return (
    <div
      ref={whiteboardContainerRef}
      className="flex flex-col w-full h-full bg-surface-900 relative"
    >
      {/* Main whiteboard area — intercept anchor clicks from Excalidraw internals to prevent page reload */}
      <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}
        onClickCapture={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('a[href]')) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-surface-800/80 border-b border-surface-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-surface-300">Whiteboard</span>
            {isLocked && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                Locked
              </span>
            )}
            {isFullscreen && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400">
                Fullscreen
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Fullscreen toggle — moderator only */}
            {isModerator && (
              <button
                onClick={handleFullscreenToggle}
                className={`p-1.5 rounded-lg transition-colors ${
                  isFullscreen
                    ? 'text-brand-400 hover:bg-brand-400/10'
                    : 'text-surface-400 hover:bg-surface-700'
                }`}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen (participants in side panel)'}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen whiteboard'}
              >
                {isFullscreen ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                )}
              </button>
            )}

            {/* Lock toggle — moderator only */}
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

            <button
              onClick={async () => {
                if (isFullscreen && document.fullscreenElement) {
                  try { await document.exitFullscreen(); } catch {}
                  setWhiteboardFullscreen(false);
                }
                if (roomName && currentSceneRef.current.length > 0) {
                  try {
                    await whiteboardApi.saveScene(roomName, currentSceneRef.current as object[]);
                  } catch (err) {
                    logger.warn('[Whiteboard] Failed to save on close', { error: err });
                  }
                }
                broadcastActivate(false);
                toggleWhiteboard();
              }}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors"
              aria-label="Close whiteboard"
              title="Close whiteboard"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Canvas + floating participant panel area */}
        <div className="flex-1 relative" style={{ minHeight: 0 }}>
          {/* Excalidraw canvas */}
          <Suspense
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
          </Suspense>

          {/* Viewport indicator overlay — shows what participants are viewing */}
          {isModerator && viewportIndicators.length > 0 && (
            <div className="absolute inset-0 pointer-events-none z-10" aria-hidden="true">
              {viewportIndicators.map(({ identity, style }) => (
                <div
                  key={identity}
                  className="absolute border-2 border-blue-400/40 rounded-sm transition-all duration-200"
                  style={style}
                >
                  <span className="absolute -top-4 left-0 text-[9px] text-blue-400 bg-surface-900/80 px-1 rounded truncate max-w-[80px]">
                    {identity.split('-')[0]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Floating participant panel — visible in fullscreen mode */}
          {isFullscreen && (
            <FloatingParticipantPanel
              participants={admittedParticipants}
              localParticipant={localParticipant}
            />
          )}
        </div>
      </div>

      {/* Bottom filmstrip — hidden in fullscreen mode */}
      {!isFullscreen && admittedParticipants.length > 0 && (
        <div
          className="flex gap-2 flex-shrink-0 overflow-x-auto overflow-y-hidden px-2 pb-2"
          style={{
            height: FILMSTRIP_HEIGHT,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.3) transparent',
          }}
        >
          {admittedParticipants.map((p) => (
            <div
              key={p.identity}
              className="flex-shrink-0 h-full rounded-lg bg-surface-900"
              style={{ width: FILMSTRIP_HEIGHT * (16 / 9) }}
            >
              <ParticipantTile participant={p} className="w-full h-full rounded-lg" isSpeakerTile={false} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
