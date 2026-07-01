/**
 * MeetingPiP — Document Picture-in-Picture window for the real meeting.
 *
 * Renders into a floating always-on-top window via createPortal.
 * Shows active speaker video (large) + filmstrip of others + compact controls
 * + live Excalidraw whiteboard preview (read-only mirror of the real board).
 *
 * ── Video rendering strategy ──
 * MediaStreamTrack set as srcObject on a <video> in the PiP document stops
 * receiving frames after ~1 second because the browser's media pipeline is
 * document-scoped.  Instead we:
 *   1. Create a hidden <video> in the MAIN document (tracks work here).
 *   2. Clone the participant's camera track onto it.
 *   3. Use PiP-window requestAnimationFrame + canvas.drawImage to mirror
 *      frames onto a <canvas> in the PiP document.
 * Cross-document drawImage works for same-origin Document PiP windows.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { Participant } from 'livekit-client';
import { usePiP } from '../../hooks/usePiP';
import { useAdmittedParticipants } from '../../hooks/useAdmittedParticipants';
import { useWhiteboardOpen, useUIActions } from '../../store/roomStore';
import { getWhiteboardAPI } from '../../services/whiteboardAPIBridge';
import { useDebugParticipants } from '../../debug/DebugParticipants';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Pencil, LayoutGrid } from 'lucide-react';

// ============================================
// Excalidraw whiteboard preview — mirrors the real board
// ============================================
const WB_POLL_MS = 500;

function WhiteboardPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderingRef = useRef(false);
  const apiRef = useRef(getWhiteboardAPI());
  const [version, setVersion] = useState(0);

  // Poll the Excalidraw API for scene changes and re-render the preview
  useEffect(() => {
    let lastSceneLength = -1;

    const render = async () => {
      const api = apiRef.current || getWhiteboardAPI();
      apiRef.current = api;
      const canvas = canvasRef.current;
      if (!api || !canvas || renderingRef.current) return;

      const elements = api.getSceneElements();
      if (!elements) return;

      // Skip if scene hasn't changed
      if (elements.length === lastSceneLength) return;
      lastSceneLength = elements.length;

      renderingRef.current = true;
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (elements.length === 0) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          return;
        }

        const { exportToCanvas } = await import('@excalidraw/excalidraw');
        const exported = await exportToCanvas({
          elements: elements as any,
          appState: {
            ...(api.getAppState() as any),
            exportBackground: true,
          } as any,
          files: (api as any).files ?? undefined,
          getDimensions: () => ({ width: canvas.width, height: canvas.height }),
        });

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Fit exported canvas into preview with padding
        const pad = 8;
        const availW = Math.max(1, canvas.width - pad * 2);
        const availH = Math.max(1, canvas.height - pad * 2);
        const scale = Math.min(availW / exported.width, availH / exported.height);
        const drawW = exported.width * scale;
        const drawH = exported.height * scale;
        const drawX = (canvas.width - drawW) / 2;
        const drawY = (canvas.height - drawH) / 2;
        ctx.drawImage(exported, drawX, drawY, drawW, drawH);
      } catch {
        // exportToCanvas can fail if elements are in flux
      } finally {
        renderingRef.current = false;
      }
    };

    const interval = setInterval(render, WB_POLL_MS);
    // Also render immediately
    void render();

    return () => clearInterval(interval);
  }, [version]);

  // Re-check API availability periodically (it may mount after PiP opens)
  useEffect(() => {
    if (apiRef.current) return;
    const check = setInterval(() => {
      const api = getWhiteboardAPI();
      if (api) {
        apiRef.current = api;
        setVersion((v) => v + 1);
        clearInterval(check);
      }
    }, 500);
    return () => clearInterval(check);
  }, []);

  return (
    <div className="flex-1 relative overflow-hidden min-h-0 bg-surface-900">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="absolute inset-0 w-full h-full"
      />
      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/50 text-white text-[10px] flex items-center gap-1.5">
        <Pencil className="w-3 h-3" />
        Whiteboard
      </div>
    </div>
  );
}

// ============================================
// CanvasVideoTile — participant video rendered via canvas.
//
// This is the core fix for PiP video not displaying.
//
// A hidden <video> source element is created in the MAIN document where
// the cloned MediaStreamTrack works reliably.  A requestAnimationFrame loop
// (driven by the PiP window so it keeps running when the main tab is
// backgrounded) copies frames onto a <canvas> in the PiP document.
// ============================================

interface CanvasVideoTileProps {
  /** Real participant to display (mutually exclusive with useLocalTrack) */
  participant?: Participant;
  /** Clone local camera track instead of a participant's (for dummy tiles) */
  useLocalTrack?: boolean;
  /** Display name shown in the label */
  displayName: string;
  /** Whether this is the local user (applies mirror) */
  isLocal?: boolean;
  /** Large speaker tile vs small filmstrip tile */
  isSpeakerTile: boolean;
  /** Dummy/debug tile styling */
  dummy?: boolean;
}

function CanvasVideoTile({
  participant,
  useLocalTrack = false,
  displayName,
  isLocal = false,
  isSpeakerTile,
  dummy = false,
}: CanvasVideoTileProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const { localParticipant } = useLocalParticipant();

  // Camera / mic state (read at render time for the label + fallback avatar)
  const sourceParticipant = useLocalTrack ? localParticipant : participant;
  const cameraEnabled = sourceParticipant?.isCameraEnabled ?? false;
  const micOn = sourceParticipant?.isMicrophoneEnabled ?? false;

  // Stable identity for the effect dependency — avoids re-running the
  // pipeline on every LiveKit property tick (audio level, etc.)
  const participantIdentity = sourceParticipant?.identity;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cameraEnabled) {
      setVideoReady(false);
      return;
    }

    let disposed = false;
    let sourceVideo: HTMLVideoElement | null = null;
    let sourceStream: MediaStream | null = null;
    let rafId: number | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    // Use the PiP window's rAF so the loop keeps running even when the
    // main tab is backgrounded (user is looking at the floating window).
    const rafWin: Window & typeof globalThis =
      (window as any).documentPictureInPicture?.window ?? window;

    // ── Source video: lives in the MAIN document ──
    // The cloned MediaStreamTrack works reliably here (same browsing context
    // as the LiveKit room).  opacity:0.01 keeps it rendering (browsers may
    // skip 0-opacity video) while making it invisible to the user.
    sourceVideo = document.createElement('video');
    sourceVideo.muted = true;
    sourceVideo.playsInline = true;
    sourceVideo.autoplay = true;
    sourceVideo.style.cssText =
      'position:fixed;top:0;left:0;width:320px;height:240px;' +
      'opacity:0.01;pointer-events:none;z-index:-1;';
    document.body.appendChild(sourceVideo);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      sourceVideo.remove();
      return;
    }

    // Resolve the raw MediaStreamTrack to clone
    const getTrack = (): MediaStreamTrack | null => {
      const p = useLocalTrack ? localParticipant : participant;
      if (!p) return null;
      const pub = p.getTrackPublication(Track.Source.Camera);
      const t = pub?.track?.mediaStreamTrack;
      if (!t || t.readyState === 'ended') return null;
      return t;
    };

    const attach = (): boolean => {
      const track = getTrack();
      if (!track || !sourceVideo) return false;
      sourceStream = new MediaStream([track.clone()]);
      sourceVideo.srcObject = sourceStream;
      void sourceVideo.play().catch(() => {});
      return true;
    };

    // rAF loop: draw source video → PiP canvas with object-fit:cover
    const drawFrame = () => {
      if (disposed || !sourceVideo || !ctx) return;

      if (sourceVideo.readyState >= 2 && sourceVideo.videoWidth > 0) {
        const vw = sourceVideo.videoWidth;
        const vh = sourceVideo.videoHeight;
        const cw = canvas.width;
        const ch = canvas.height;

        if (vw > 0 && vh > 0 && cw > 0 && ch > 0) {
          // Manual object-fit: cover — crop source to match canvas AR
          const vAR = vw / vh;
          const cAR = cw / ch;
          let sx = 0, sy = 0, sw = vw, sh = vh;

          if (vAR > cAR) {
            // Source is wider — crop horizontally
            sw = vh * cAR;
            sx = (vw - sw) / 2;
          } else {
            // Source is taller — crop vertically
            sh = vw / cAR;
            sy = (vh - sh) / 2;
          }

          ctx.drawImage(sourceVideo, sx, sy, sw, sh, 0, 0, cw, ch);
        }
      }

      rafId = rafWin.requestAnimationFrame(drawFrame);
    };

    const onSourceReady = () => {
      if (disposed) return;
      setVideoReady(true);
      drawFrame();
    };

    // Phase 1: attach track (retry until camera publication is available)
    if (attach()) {
      sourceVideo.addEventListener('loadeddata', onSourceReady, { once: true });
    } else {
      retryTimer = setInterval(() => {
        if (disposed) {
          clearInterval(retryTimer!);
          return;
        }
        if (attach()) {
          clearInterval(retryTimer!);
          retryTimer = null;
          sourceVideo!.addEventListener('loadeddata', onSourceReady, { once: true });
        }
      }, 500);
    }

    // ── Cleanup ──
    return () => {
      disposed = true;
      if (rafId !== null) rafWin.cancelAnimationFrame(rafId);
      if (retryTimer) clearInterval(retryTimer);
      sourceVideo?.removeEventListener('loadeddata', onSourceReady);
      sourceStream?.getTracks().forEach((t) => t.stop());
      if (sourceVideo) {
        sourceVideo.srcObject = null;
        sourceVideo.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraEnabled, participantIdentity, useLocalTrack]);

  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const showVideo = videoReady && cameraEnabled;

  return (
    <div
      className={`relative w-full h-full rounded-lg overflow-hidden ${
        dummy
          ? 'bg-gradient-to-br from-surface-700 to-surface-800 ring-1 ring-warning-500/40'
          : 'bg-surface-800'
      }`}
    >
      {/* Canvas mirrors frames from the hidden main-doc source video */}
      <canvas
        ref={canvasRef}
        width={isSpeakerTile ? 480 : 160}
        height={isSpeakerTile ? 360 : 120}
        className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
          showVideo ? 'opacity-100' : 'opacity-0'
        }`}
        style={isLocal ? { transform: 'scaleX(-1)' } : undefined}
      />

      {/* Avatar fallback */}
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`${
              isSpeakerTile ? 'w-16 h-16 text-xl' : 'w-8 h-8 text-xs'
            } rounded-full ${
              dummy ? 'bg-warning-600' : 'bg-surface-600'
            } flex items-center justify-center font-bold text-white`}
          >
            {initials}
          </div>
        </div>
      )}

      {/* Name + mic indicator */}
      <div
        className={`absolute ${
          isSpeakerTile ? 'bottom-1.5 left-1.5' : 'bottom-0.5 left-0.5'
        } flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm`}
      >
        {dummy && <span className="text-[9px]">🤖</span>}
        {!micOn && (
          <MicOff
            className={isSpeakerTile ? 'w-3 h-3' : 'w-2.5 h-2.5'}
            style={{ color: '#f87171' }}
          />
        )}
        <span
          className={`text-white font-medium truncate ${
            isSpeakerTile ? 'text-xs max-w-[200px]' : 'text-[10px] max-w-[80px]'
          }`}
        >
          {displayName}
          {isLocal && ' (You)'}
        </span>
      </div>
    </div>
  );
}

// ============================================
// PiP content — rendered inside the floating window via portal
// ============================================
interface MeetingPiPContentProps {
  activeSpeakers: Participant[];
  micEnabled: boolean;
  cameraEnabled: boolean;
  whiteboardOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleWhiteboard: () => void;
  onClose: () => void;
}

function MeetingPiPContent({
  activeSpeakers,
  micEnabled,
  cameraEnabled,
  whiteboardOn,
  onToggleMic,
  onToggleCamera,
  onToggleWhiteboard,
  onClose,
}: MeetingPiPContentProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const admitted = useAdmittedParticipants(participants, localParticipant?.identity);
  const { names: debugNames } = useDebugParticipants();
  const [showWhiteboardView, setShowWhiteboardView] = useState(true);

  useEffect(() => {
    if (whiteboardOn) setShowWhiteboardView(true);
  }, [whiteboardOn]);

  const activeSpeaker = useMemo(() => {
    const speaking = activeSpeakers.find((s) =>
      admitted.some((a) => a.identity === s.identity && a.isCameraEnabled)
    );
    if (speaking) return speaking;
    const anySpeaking = activeSpeakers.find((s) => admitted.some((a) => a.identity === s.identity));
    if (anySpeaking) return anySpeaking;
    const firstWithCamera = admitted.find((p) => p.isCameraEnabled);
    if (firstWithCamera) return firstWithCamera;
    return admitted.find((p) => p.isLocal) ?? admitted[0];
  }, [activeSpeakers, admitted]);

  const others = useMemo(
    () => admitted.filter((p) => p.identity !== activeSpeaker?.identity),
    [admitted, activeSpeaker]
  );

  // Debug: dummy tiles shown as main speaker fallback + filmstrip extras
  const debugMain = !activeSpeaker && debugNames.length > 0 ? debugNames[0] : null;
  const debugOthers = debugNames.slice(activeSpeaker ? 0 : 1);

  return (
    <div className="w-full h-full flex flex-col bg-surface-900">
      {whiteboardOn && showWhiteboardView ? (
        <WhiteboardPreview />
      ) : (
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 relative overflow-hidden bg-black min-h-0">
            {activeSpeaker && (
              <CanvasVideoTile
                participant={activeSpeaker}
                displayName={activeSpeaker.name || activeSpeaker.identity}
                isLocal={activeSpeaker.isLocal}
                isSpeakerTile
              />
            )}
            {debugMain && (
              <CanvasVideoTile
                useLocalTrack
                displayName={debugMain}
                isLocal
                isSpeakerTile
                dummy
              />
            )}
          </div>
          {(others.length > 0 || debugOthers.length > 0) && (
            <div
              className="w-[100px] flex flex-col gap-1.5 p-1.5 bg-surface-900 overflow-y-auto"
              style={{ maxHeight: '100%' }}
            >
              {others.map((p) => (
                <div key={p.identity} className="h-20 shrink-0">
                  <CanvasVideoTile
                    participant={p}
                    displayName={p.name || p.identity}
                    isLocal={p.isLocal}
                    isSpeakerTile={false}
                  />
                </div>
              ))}
              {debugOthers.map((name) => (
                <div key={`debug-${name}`} className="h-20 shrink-0">
                  <CanvasVideoTile
                    useLocalTrack
                    displayName={name}
                    isLocal
                    isSpeakerTile={false}
                    dummy
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-2 p-2 bg-surface-800">
        <button
          onClick={onToggleMic}
          aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            micEnabled ? 'bg-surface-600 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>
        <button
          onClick={onToggleCamera}
          aria-label={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            cameraEnabled ? 'bg-surface-600 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {cameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </button>
        {whiteboardOn && (
          <button
            onClick={() => setShowWhiteboardView((v) => !v)}
            aria-label={showWhiteboardView ? 'Switch to video view' : 'Switch to whiteboard view'}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-surface-600 text-white"
          >
            {showWhiteboardView ? <LayoutGrid className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
          </button>
        )}
        <button
          onClick={onToggleWhiteboard}
          aria-label={whiteboardOn ? 'Close whiteboard' : 'Open whiteboard'}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            whiteboardOn ? 'bg-brand-500 text-white' : 'bg-surface-600 text-white'
          }`}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          aria-label="Leave call"
          className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// Main hook — useMeetingPiP
// ============================================
interface UseMeetingPiPOptions {
  activeSpeakers: Participant[];
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
}

export function useMeetingPiP({ activeSpeakers, onToggleMic, onToggleCamera, onLeave }: UseMeetingPiPOptions) {
  const { pipWindow, isSupported, togglePiP, closePiP } = usePiP();
  const whiteboardOpen = useWhiteboardOpen();
  const { toggleWhiteboard } = useUIActions();

  const { localParticipant } = useLocalParticipant();
  const micEnabled = localParticipant?.isMicrophoneEnabled ?? false;
  const cameraEnabled = localParticipant?.isCameraEnabled ?? false;

  const handleClose = useCallback(() => {
    closePiP();
    onLeave();
  }, [closePiP, onLeave]);

  const pipContent = pipWindow ? (
    <MeetingPiPContent
      activeSpeakers={activeSpeakers}
      micEnabled={micEnabled}
      cameraEnabled={cameraEnabled}
      whiteboardOn={whiteboardOpen}
      onToggleMic={onToggleMic}
      onToggleCamera={onToggleCamera}
      onToggleWhiteboard={toggleWhiteboard}
      onClose={handleClose}
    />
  ) : null;

  const portalTarget = pipWindow?.document?.body ?? null;

  return {
    isSupported,
    pipWindow,
    togglePiP,
    pipContent: portalTarget ? createPortal(pipContent, portalTarget) : null,
  };
}
