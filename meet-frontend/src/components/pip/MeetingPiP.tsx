/**
 * MeetingPiP — Document Picture-in-Picture window for the real meeting.
 *
 * Renders into a floating always-on-top window via createPortal.
 * Shows active speaker video (large) + filmstrip of others + compact controls
 * + live Excalidraw whiteboard preview (read-only mirror of the real board).
 *
 * ── Video rendering strategy ──
 * Video tiles use track.attach() on <video> elements rendered inside the PiP
 * document (via React portal).  LiveKit's adaptive stream controller detects
 * that the element is inside documentPictureInPicture.window and keeps the
 * track subscribed even when the main tab is backgrounded.
 *
 * Previous canvas-mirror approach failed because the hidden <video> in the
 * backgrounded main tab stopped decoding (browser power optimisation),
 * causing the canvas to go blank after ~1 second.
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
// PipVideoTile — participant video via LiveKit track.attach().
//
// The <video> element is rendered inside the PiP document (via React portal).
// Calling track.attach() registers it with LiveKit's adaptive stream,
// which detects the Document PiP window and keeps the track subscribed
// even when the main tab is backgrounded.  No canvas, no cloning, no rAF.
// ============================================

interface PipVideoTileProps {
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

function PipVideoTile({
  participant,
  useLocalTrack = false,
  displayName,
  isLocal = false,
  isSpeakerTile,
  dummy = false,
}: PipVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const { localParticipant } = useLocalParticipant();

  const sourceParticipant = useLocalTrack ? localParticipant : participant;
  const cameraEnabled = sourceParticipant?.isCameraEnabled ?? false;
  const micOn = sourceParticipant?.isMicrophoneEnabled ?? false;

  // Stable identity for the effect dependency — avoids re-running on
  // every LiveKit property tick (audio level, etc.)
  const participantIdentity = sourceParticipant?.identity;

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !cameraEnabled) {
      setVideoReady(false);
      return;
    }

    let disposed = false;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const getTrack = () => {
      const p = useLocalTrack ? localParticipant : participant;
      if (!p) return null;
      const pub = p.getTrackPublication(Track.Source.Camera);
      return pub?.track ?? null;
    };

    const onLoadedData = () => {
      if (!disposed) setVideoReady(true);
    };

    const doAttach = (): boolean => {
      const track = getTrack();
      if (!track) return false;

      try {
        // track.attach() sets srcObject and registers the element with
        // LiveKit's adaptive stream — which detects Document PiP and
        // keeps the track subscribed when the main tab backgrounds.
        track.attach(videoEl);
      } catch (err) {
        // Fallback: some browsers throw on IntersectionObserver for
        // cross-document elements — manually set srcObject instead.
        console.warn('[PiP] track.attach() threw, using manual srcObject:', err);
        videoEl.srcObject = new MediaStream([track.mediaStreamTrack]);
        void videoEl.play().catch(() => {});
      }

      if (videoEl.readyState >= 2) {
        setVideoReady(true);
      } else {
        videoEl.addEventListener('loadeddata', onLoadedData, { once: true });
      }
      return true;
    };

    if (!doAttach()) {
      retryTimer = setInterval(() => {
        if (disposed) {
          clearInterval(retryTimer!);
          return;
        }
        if (doAttach()) {
          clearInterval(retryTimer!);
          retryTimer = null;
        }
      }, 500);
    }

    return () => {
      disposed = true;
      if (retryTimer) clearInterval(retryTimer);
      videoEl?.removeEventListener('loadeddata', onLoadedData);
      const track = getTrack();
      if (track) {
        try {
          track.detach(videoEl);
        } catch {
          // ignore detach errors on cleanup
        }
      }
      videoEl.srcObject = null;
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
      {/* LiveKit-managed <video> — track.attach() keeps it subscribed */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
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
              <PipVideoTile
                participant={activeSpeaker}
                displayName={activeSpeaker.name || activeSpeaker.identity}
                isLocal={activeSpeaker.isLocal}
                isSpeakerTile
              />
            )}
            {debugMain && (
              <PipVideoTile
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
                  <PipVideoTile
                    participant={p}
                    displayName={p.name || p.identity}
                    isLocal={p.isLocal}
                    isSpeakerTile={false}
                  />
                </div>
              ))}
              {debugOthers.map((name) => (
                <div key={`debug-${name}`} className="h-20 shrink-0">
                  <PipVideoTile
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
