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
  useGridAspectRatio,
  type GridAspectRatio,
} from '../../store/roomStore';
import {
  useWhiteboardSync,
  type WhiteboardMessage,
  type ParticipantViewports,
} from '../../hooks/useWhiteboardSync';
import { useWhiteboardAutoSave } from '../../hooks/useWhiteboardAutoSave';
import { whiteboardApi } from '../../services/whiteboardApi';
import { setWhiteboardAPI } from '../../services/whiteboardAPIBridge';
import { SafeParticipantTile as ParticipantTile } from './ParticipantTile';
import { FloatingParticipantPanel } from './FloatingParticipantPanel';
import { WhiteboardPreviewTile } from './WhiteboardPreviewTile';
import { useAdmittedParticipants } from '../../hooks/useAdmittedParticipants';
import { useIsMobile } from '../../hooks/useIsMobile';
import logger from '../../utils/logger';

import '@excalidraw/excalidraw/index.css';

const Excalidraw = React.lazy(() =>
  import('@excalidraw/excalidraw').then((mod) => ({ default: mod.Excalidraw })),
);

interface WhiteboardLayoutProps {
  room: Room | null;
  roomName?: string;
}

const ASPECT_RATIO_MULTIPLIERS: Record<GridAspectRatio, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:3': 4 / 3,
};

const WHITEBOARD_CACHE_MAX = 5;
const whiteboardSceneCache = new Map<string, { scene: unknown[]; files?: Record<string, unknown>; locked: boolean }>();

function setSceneCache(key: string, value: { scene: unknown[]; files?: Record<string, unknown>; locked: boolean }) {
  whiteboardSceneCache.set(key, value);
  if (whiteboardSceneCache.size > WHITEBOARD_CACHE_MAX) {
    const oldestKey = whiteboardSceneCache.keys().next().value;
    if (oldestKey) whiteboardSceneCache.delete(oldestKey);
  }
}

export function WhiteboardLayout({ room, roomName }: WhiteboardLayoutProps) {
  const { toggleWhiteboard, setWhiteboardFullscreen } = useUIActions();
  const isModerator = useIsModerator();
  const isFullscreen = useWhiteboardFullscreen();
  const { localParticipant } = useLocalParticipant();
  const allParticipants = useParticipants();
  const localIdentity = localParticipant?.identity ?? '';
  const aspectRatio = useGridAspectRatio();
  const isMobile = useIsMobile();

  const filmstripHeightCss = isMobile ? '12dvh' : '119px';
  const filmstripPx = isMobile ? Math.round(window.innerHeight * 0.12) : 119;
  const filmstripGap = Math.max(6, Math.round(filmstripPx * 0.06));
  const filmstripPaddingX = Math.max(6, Math.round(filmstripPx * 0.08));
  const filmstripPaddingBottom = Math.max(6, Math.round(filmstripPx * 0.08));

  const admittedParticipants = useAdmittedParticipants(allParticipants, localIdentity);

  // Ref for the container that goes browser-fullscreen
  const whiteboardContainerRef = useRef<HTMLDivElement>(null);

  // Refs — avoid state changes that trigger Excalidraw re-renders
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const currentSceneRef = useRef<unknown[]>([]);
  const sceneBoundsRef = useRef<{ minX: number; minY: number; width: number; height: number } | null>(null);
  const lastViewportSignatureRef = useRef<string | null>(null);

  const [isLocked, setIsLocked] = useState(true);
  const [excalidrawReady, setExcalidrawReady] = useState(false);
  const sceneVersionRef = useRef(0);
  const sceneVersionTickRef = useRef(0);
  const [sceneVersionTick, setSceneVersionTick] = useState(0);
  const sceneRafRef = useRef<number | null>(null);

  // Track what each participant is viewing on the canvas
  const [participantViewports, setParticipantViewports] = useState<ParticipantViewports>({});

  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;

  const applySceneElements = useCallback((scene: unknown[]) => {
    // Guard: don't let a spurious empty scene (e.g. Excalidraw mount) wipe existing content
    if (scene.length === 0 && currentSceneRef.current.length > 0) {
      return;
    }

    currentSceneRef.current = [...scene];

    if (roomName) {
      setSceneCache(roomName, {
        scene: [...scene],
        files: ((excalidrawAPIRef.current as any)?.files || undefined) as Record<string, unknown> | undefined,
        locked: isLockedRef.current,
      });
    }

    if (scene.length === 0) {
      sceneBoundsRef.current = null;
      lastViewportSignatureRef.current = null;
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of scene as Array<{ x: number; y: number; width?: number; height?: number }>) {
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      const elRight = el.x + (el.width || 0);
      const elBottom = el.y + (el.height || 0);
      if (elRight > maxX) maxX = elRight;
      if (elBottom > maxY) maxY = elBottom;
    }

    sceneBoundsRef.current = {
      minX,
      minY,
      width: maxX - minX || 1,
      height: maxY - minY || 1,
    };
  }, [roomName]);

  const bumpSceneVersion = useCallback(() => {
    sceneVersionRef.current += 1;
    if (sceneRafRef.current === null) {
      sceneRafRef.current = requestAnimationFrame(() => {
        sceneRafRef.current = null;
        sceneVersionTickRef.current = sceneVersionRef.current;
        setSceneVersionTick((n) => n + 1);
      });
    }
  }, []);

  // Single whiteboard sync hook — handles broadcast + receive
  const { broadcastChange, broadcastLock, broadcastActivate, broadcastViewport } = useWhiteboardSync(
    room,
    localParticipant ?? null,
    excalidrawAPIRef,
    bumpSceneVersion,
    applySceneElements,
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
    if (!roomName || !excalidrawReady || !excalidrawAPIRef.current || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const cached = whiteboardSceneCache.get(roomName);
    if (cached && cached.scene.length > 0) {
      setIsLocked(cached.locked);
      applySceneElements(cached.scene);
      excalidrawAPIRef.current.updateScene({ elements: cached.scene as any[], files: cached.files as any } as any);
      excalidrawAPIRef.current.scrollToContent(cached.scene as any[], {
        fitToContent: true,
        animate: false,
      });
      return;
    }

    // Fall through to backend fetch whether cache was empty or missing entirely
    whiteboardApi.getState(roomName).then((state) => {
      if (state) {
        setIsLocked(state.locked);
        if (excalidrawAPIRef.current && Array.isArray(state.scene) && state.scene.length > 0) {
          applySceneElements(state.scene as unknown[]);
          excalidrawAPIRef.current.updateScene({ elements: state.scene as any[], files: state.files as any } as any);
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
  }, [applySceneElements, excalidrawReady, roomName]);

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
          if (roomName) {
            setSceneCache(roomName, {
              scene: [...currentSceneRef.current],
              files: ((excalidrawAPIRef.current as any)?.files || undefined) as Record<string, unknown> | undefined,
              locked: msg.locked,
            });
          }
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
    const handleParticipantDisconnected = (participant: { identity: string }) => {
      setParticipantViewports((prev) => {
        if (!prev[participant.identity]) return prev;
        const next = { ...prev };
        delete next[participant.identity];
        return next;
      });
    };
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [room, localIdentity, roomName]);

  // Broadcast local viewport when the user pans/zooms or viewport size changes
  useEffect(() => {
    const api = excalidrawAPIRef.current;
    const container = whiteboardContainerRef.current;
    if (!api || !room || !container) return;

    let rafId: number | null = null;
    let dragging = false;

    const broadcastLocalViewport = () => {
      rafId = null;
      try {
        const appState = api.getAppState();
        const { scrollX, scrollY, zoom, width, height } = appState;
        const zoomValue = typeof zoom === 'object' ? zoom.value : zoom;

        const viewX = -scrollX / zoomValue;
        const viewY = -scrollY / zoomValue;
        const viewW = width / zoomValue;
        const viewH = height / zoomValue;

        const bounds = sceneBoundsRef.current;
        if (!bounds) return;

        const nextViewport = {
          x: (viewX - bounds.minX) / bounds.width,
          y: (viewY - bounds.minY) / bounds.height,
          width: viewW / bounds.width,
          height: viewH / bounds.height,
        };

        const signature = JSON.stringify([
          Math.round(nextViewport.x * 1000),
          Math.round(nextViewport.y * 1000),
          Math.round(nextViewport.width * 1000),
          Math.round(nextViewport.height * 1000),
        ]);
        if (signature === lastViewportSignatureRef.current) return;
        lastViewportSignatureRef.current = signature;

        broadcastViewport(nextViewport);
      } catch {
        // ignore
      }
    };

    const scheduleBroadcast = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(broadcastLocalViewport);
    };

    const handlePointerDown = () => {
      dragging = true;
      scheduleBroadcast();
    };
    const handlePointerMove = () => {
      if (dragging) scheduleBroadcast();
    };
    const handlePointerUp = () => {
      dragging = false;
      scheduleBroadcast();
    };
    const handleWheel = () => scheduleBroadcast();
    const handleResize = () => scheduleBroadcast();

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('resize', handleResize);

    scheduleBroadcast();

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
    };
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
    setWhiteboardAPI(api);
    setExcalidrawReady(true);
  }, []);

  // Clear API bridge + cancel pending rAF on unmount
  useEffect(() => {
    return () => {
      setWhiteboardAPI(null);
      if (sceneRafRef.current !== null) {
        cancelAnimationFrame(sceneRafRef.current);
        sceneRafRef.current = null;
      }
    };
  }, []);

  // Handle drawing changes — broadcast if user can edit
  const handleChange = useCallback(
    (elements: readonly any[]) => {
      // Skip spurious onChange fires before initial scene load (Excalidraw mount)
      if (!hasLoadedRef.current) return;
      applySceneElements(elements as unknown[]);
      bumpSceneVersion();
      if (canEditRef.current) {
        broadcastChange(elements);
        (currentSceneRef as any).__markDirty?.();
      }
    },
    [applySceneElements, broadcastChange, bumpSceneVersion],
  );

  const handleToggleLock = useCallback(async () => {
    const next = !isLocked;
    setIsLocked(next);
    if (roomName) {
      setSceneCache(roomName, {
        scene: [...currentSceneRef.current],
        files: ((excalidrawAPIRef.current as any)?.files || undefined) as Record<string, unknown> | undefined,
        locked: next,
      });
    }
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

  // Provide initialData synchronously from cache so Excalidraw mounts with content
  const initialData = useMemo(() => {
    if (!roomName) return undefined;
    const cached = whiteboardSceneCache.get(roomName);
    if (!cached || cached.scene.length === 0) return undefined;
    return {
      elements: cached.scene,
      appState: { gridSize: null },
      files: cached.files,
      scrollToContent: true,
    } as any;
  }, [roomName]);

  return (
    <div
      ref={whiteboardContainerRef}
      className="flex flex-col w-full h-full bg-surface-900 relative overscroll-none"
      style={{ touchAction: 'none' }}
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
        <div className="flex items-center justify-between px-2 sm:px-3 py-1 sm:py-1.5 bg-surface-800/80 border-b border-surface-700 flex-shrink-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-[10px] sm:text-xs font-medium text-surface-300">Whiteboard</span>
            {isLocked && (
              <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                Locked
              </span>
            )}
            {isFullscreen && (
              <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400">
                Fullscreen
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
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
                    await whiteboardApi.saveScene(roomName, currentSceneRef.current as object[], (excalidrawAPIRef.current as any)?.files);
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
                initialData={initialData}
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

      {!isFullscreen && admittedParticipants.length > 0 && (
        <div
          className="flex flex-shrink-0 overflow-x-auto overflow-y-hidden"
          style={{
            height: filmstripHeightCss,
            gap: `${filmstripGap}px`,
            paddingInline: `${filmstripPaddingX}px`,
            paddingBottom: `${filmstripPaddingBottom}px`,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.3) transparent',
          }}
        >
          <div
            className="flex-shrink-0 h-full rounded-2xl bg-surface-900"
            style={{ width: filmstripPx * ASPECT_RATIO_MULTIPLIERS[aspectRatio] }}
          >
            <WhiteboardPreviewTile
              excalidrawAPI={excalidrawAPIRef.current}
              sourceElement={whiteboardContainerRef.current}
              sceneVersion={sceneVersionTick}
              width={Math.round(filmstripPx * ASPECT_RATIO_MULTIPLIERS[aspectRatio])}
              height={filmstripPx}
            />
          </div>
          {admittedParticipants.map((p) => (
            <div
              key={p.identity}
              className="flex-shrink-0 h-full rounded-2xl bg-surface-900"
              style={{ width: filmstripPx * ASPECT_RATIO_MULTIPLIERS[aspectRatio] }}
            >
              <ParticipantTile participant={p} className="w-full h-full rounded-2xl" isSpeakerTile={false} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
