/**
 * MeetingPiP — Document Picture-in-Picture window for the real meeting.
 *
 * Renders into a floating always-on-top window via createPortal.
 * Shows active speaker video (large) + filmstrip of others + compact controls
 * + shared whiteboard canvas. All LiveKit tracks attached directly via
 * track.attach() which works across documents (MediaStreamTrack is not
 * document-bound).
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { Track, type Participant } from 'livekit-client';
import { usePiP } from '../../hooks/usePiP';
import { useAdmittedParticipants } from '../../hooks/useAdmittedParticipants';
import { useWhiteboardOpen, useUIActions } from '../../store/roomStore';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Pencil, LayoutGrid, Eraser, Trash2 } from 'lucide-react';

// ============================================
// Constants
// ============================================
const WB_BG = '#0f172a';
const WB_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#ffffff', '#f97316'];
const BRUSH_SIZES = [2, 5, 12];
const REF_WIDTH = 1600;

type Point = { x: number; y: number };
type Stroke = {
  id: string;
  points: Point[];
  color: string;
  size: number;
  isEraser: boolean;
};

// ============================================
// PiP Video Tile — direct track.attach for cross-document rendering
// ============================================
function PiPVideoTile({ participant, isLarge }: { participant: Participant; isLarge: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    let attachedTrack: Track | undefined;

    for (const [, pub] of participant.trackPublications) {
      if (pub.source === Track.Source.Camera && pub.track) {
        attachedTrack = pub.track;
        break;
      }
    }

    const isCameraOn = participant.isCameraEnabled && !!attachedTrack;
    setHasVideo(isCameraOn);

    if (isCameraOn && attachedTrack) {
      try {
        attachedTrack.attach(el);
      } catch { /* track may not be ready */ }
    }

    return () => {
      if (attachedTrack) {
        try { attachedTrack.detach(el); } catch { /* already detached */ }
      }
    };
  }, [participant, participant.isCameraEnabled, participant.trackPublications.size]);

  const name = participant.name || participant.identity?.slice(0, 12) || 'Guest';
  const initials = name.slice(0, 2).toUpperCase();
  const isSpeaking = participant.isSpeaking;
  const isLocal = participant.isLocal;
  const avatarSize = isLarge ? 'w-16 h-16 text-xl' : 'w-7 h-7 text-[10px]';

  return (
    <div
      className={`relative overflow-hidden bg-black ${
        isLarge ? 'w-full h-full' : 'w-full h-14 shrink-0 rounded-md'
      }`}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isLocal ? '-scale-x-100' : ''}`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700">
          <div className={`${avatarSize} rounded-full bg-black/30 flex items-center justify-center text-white font-bold`}>
            {initials}
          </div>
        </div>
      )}
      <div className={`absolute bottom-0.5 left-0.5 px-1 py-0.5 rounded bg-black/60 text-white flex items-center gap-1 ${isLarge ? 'text-[11px]' : 'text-[9px]'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isSpeaking ? 'bg-emerald-400 animate-pulse' : 'bg-surface-500'}`} />
        {isLocal ? 'You' : name}
      </div>
      {isSpeaking && (
        <div className={`absolute inset-0 ring-2 ring-emerald-400 ${isLarge ? '' : 'rounded-md'} pointer-events-none`} />
      )}
    </div>
  );
}

// ============================================
// Shared whiteboard state — lifted, rendered via portal in both views
// ============================================
function useWhiteboardState() {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const activeRef = useRef<Stroke | null>(null);

  const beginStroke = useCallback((x: number, y: number, color: string, size: number, isEraser: boolean) => {
    const s: Stroke = {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      points: [{ x, y }],
      color: isEraser ? WB_BG : color,
      size: isEraser ? size * 4 : size,
      isEraser,
    };
    activeRef.current = s;
    setActiveStroke(s);
  }, []);

  const extendStroke = useCallback((x: number, y: number) => {
    const s = activeRef.current;
    if (!s) return;
    s.points.push({ x, y });
    setActiveStroke({ ...s, points: [...s.points] });
  }, []);

  const commitStroke = useCallback(() => {
    const s = activeRef.current;
    if (s && s.points.length > 0) {
      setStrokes((prev) => [...prev, s]);
    }
    activeRef.current = null;
    setActiveStroke(null);
  }, []);

  const clear = useCallback(() => {
    activeRef.current = null;
    setActiveStroke(null);
    setStrokes([]);
  }, []);

  return { strokes, activeStroke, beginStroke, extendStroke, commitStroke, clear };
}

type WbState = ReturnType<typeof useWhiteboardState>;

// ============================================
// Shared canvas — renders strokes, forwards pointer events as normalized [0,1]
// ============================================
function SharedCanvas({
  strokes,
  activeStroke,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  strokes: Stroke[];
  activeStroke: Stroke | null;
  onPointerDown: (x: number, y: number) => void;
  onPointerMove: (x: number, y: number) => void;
  onPointerUp: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = WB_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';

    const allStrokes = activeStroke ? [...strokes, activeStroke] : strokes;
    const scale = canvas.width / REF_WIDTH;

    for (const stroke of allStrokes) {
      if (stroke.points.length < 1) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(0.5, stroke.size * scale);
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * canvas.width, stroke.points[0].y * canvas.height);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * canvas.width, stroke.points[i].y * canvas.height);
      }
      ctx.stroke();
    }
  }, [strokes, activeStroke]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  return (
    <canvas
      ref={canvasRef}
      width={1600}
      height={900}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = getPos(e);
        onPointerDown(p.x, p.y);
      }}
      onPointerMove={(e) => {
        const p = getPos(e);
        onPointerMove(p.x, p.y);
      }}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
    />
  );
}

// ============================================
// PiP whiteboard (compact toolbar)
// ============================================
function PiPWhiteboard({ wb }: { wb: WbState }) {
  const [color, setColor] = useState(WB_COLORS[0]);
  const [isEraser, setIsEraser] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-1 px-1.5 py-1 bg-surface-800 border-b border-surface-700 shrink-0">
        {WB_COLORS.slice(0, 5).map((c) => (
          <button
            key={c}
            onClick={() => { setColor(c); setIsEraser(false); }}
            className={`w-5 h-5 rounded-full border-2 transition-transform ${
              color === c && !isEraser ? 'border-white scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
            aria-label={`Color ${c}`}
          />
        ))}
        <div className="w-px h-4 bg-surface-600 mx-0.5" />
        <button
          onClick={() => setIsEraser(!isEraser)}
          className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
            isEraser ? 'bg-brand-500 text-white' : 'bg-surface-600 text-surface-200'
          }`}
          aria-label="Eraser"
        >
          <Eraser className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={wb.clear}
          className="w-6 h-6 rounded flex items-center justify-center bg-surface-600 hover:bg-red-500 text-surface-200 transition-colors"
          aria-label="Clear board"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 relative overflow-hidden min-h-0">
        <SharedCanvas
          strokes={wb.strokes}
          activeStroke={wb.activeStroke}
          onPointerDown={(x, y) => wb.beginStroke(x, y, color, BRUSH_SIZES[1], isEraser)}
          onPointerMove={wb.extendStroke}
          onPointerUp={wb.commitStroke}
        />
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
  wb: WbState;
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
  wb,
  onToggleMic,
  onToggleCamera,
  onToggleWhiteboard,
  onClose,
}: MeetingPiPContentProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const admitted = useAdmittedParticipants(participants, localParticipant?.identity);
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

  return (
    <div className="w-full h-full flex flex-col bg-surface-900">
      {whiteboardOn && showWhiteboardView ? (
        <PiPWhiteboard wb={wb} />
      ) : (
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 relative overflow-hidden bg-black min-h-0">
            {activeSpeaker && <PiPVideoTile participant={activeSpeaker} isLarge />}
          </div>
          {others.length > 0 && (
            <div
              className="w-[83px] flex flex-col gap-1.5 p-1.5 bg-surface-950 overflow-y-auto"
              style={{ maxHeight: '100%' }}
            >
              {others.map((p) => (
                <PiPVideoTile key={p.identity} participant={p} isLarge={false} />
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
  const wb = useWhiteboardState();

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
      wb={wb}
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
