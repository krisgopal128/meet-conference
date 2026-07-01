/**
 * MeetingPiP — Document Picture-in-Picture window for the real meeting.
 *
 * Renders into a floating always-on-top window via createPortal.
 * Shows active speaker video (large) + filmstrip of others + compact controls
 * + live Excalidraw whiteboard preview (read-only mirror of the real board).
 *
 * Video tiles use the SAME SafeParticipantTile as the main room grid, so
 * adaptive stream, quality indicators, connection quality, and avatar/name
 * styling are identical between PiP and main room.
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
import { useDebugParticipants, DummyParticipantTile } from '../../debug/DebugParticipants';
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
// PiPVideoTile — participant video that bypasses LiveKit adaptive stream
//
// LiveKit's adaptive stream uses IntersectionObserver/ResizeObserver bound to
// the MAIN document. A <video> living inside the Document PiP window (a separate
// document) is invisible to those observers, so LiveKit pauses the track after
// ~1s. Cloning the MediaStreamTrack onto a plain <video> sidesteps this entirely.
// ============================================

interface PiPVideoTileProps {
  participant: Participant;
  isSpeakerTile: boolean;
}

function PiPVideoTile({ participant, isSpeakerTile }: PiPVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const isLocal = participant.isLocal;
  const cameraEnabled = participant.isCameraEnabled;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cameraEnabled) {
      setVideoReady(false);
      return;
    }

    let stream: MediaStream | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const setup = (): boolean => {
      const pub = participant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track?.mediaStreamTrack;
      if (!track || track.readyState === 'ended') return false;

      // Clone the track so the PiP <video> is independent of LiveKit's
      // adaptive-stream control — works inside the separate PiP document.
      stream = new MediaStream([track.clone()]);
      video.srcObject = stream;
      void video.play().catch(() => {});
      return true;
    };

    if (setup()) {
      setVideoReady(true);
    } else {
      interval = setInterval(() => {
        if (setup()) {
          setVideoReady(true);
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [participant, cameraEnabled]);

  const initials = (participant.name || participant.identity)
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const micOn = participant.isMicrophoneEnabled;
  const showVideo = videoReady && cameraEnabled;

  return (
    <div className="relative w-full h-full bg-surface-800 rounded-lg overflow-hidden">
      {/* Cloned camera video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedData={() => setVideoReady(true)}
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
            } rounded-full bg-surface-600 flex items-center justify-center font-bold text-white`}
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
        {!micOn && <MicOff className={isSpeakerTile ? 'w-3 h-3' : 'w-2.5 h-2.5'} style={{ color: '#f87171' }} />}
        <span
          className={`text-white font-medium truncate ${
            isSpeakerTile ? 'text-xs max-w-[200px]' : 'text-[10px] max-w-[80px]'
          }`}
        >
          {participant.name || participant.identity}
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
              <PiPVideoTile participant={activeSpeaker} isSpeakerTile />
            )}
            {debugMain && (
              <DummyParticipantTile name={debugMain} />
            )}
          </div>
          {(others.length > 0 || debugOthers.length > 0) && (
            <div
              className="w-[100px] flex flex-col gap-1.5 p-1.5 bg-surface-950 overflow-y-auto"
              style={{ maxHeight: '100%' }}
            >
              {others.map((p) => (
                <div key={p.identity} className="h-20 shrink-0">
                  <PiPVideoTile participant={p} isSpeakerTile={false} />
                </div>
              ))}
              {debugOthers.map((name) => (
                <div key={`debug-${name}`} className="h-20 shrink-0">
                  <DummyParticipantTile name={name} size="small" />
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
