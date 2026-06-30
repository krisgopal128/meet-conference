import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePiP } from '../hooks/usePiP';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  PictureInPicture2,
  Monitor,
  MessageSquare,
  Users,
  Settings,
  Pencil,
  Eraser,
  Trash2,
  LayoutGrid,
} from 'lucide-react';

// --- Shared participant type ---
type Participant = {
  id: string;
  name: string;
  isLocal: boolean;
  speaking: boolean;
  color: string;
  stream?: MediaStream | null;
  cameraOff?: boolean;
};

// --- Name pool for generating participants (up to 150) ---
const BASE_NAMES = [
  'Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Henry',
  'Ivy', 'Jack', 'Karen', 'Leo', 'Mia', 'Noah', 'Olivia', 'Peter',
  'Quinn', 'Ryan', 'Sara', 'Tom', 'Uma', 'Victor', 'Wendy', 'Xavier',
  'Yara', 'Zane', 'Aaron', 'Bella', 'Caleb', 'Daisy', 'Ethan', 'Fiona',
  'George', 'Hannah', 'Ian', 'Julia', 'Kevin', 'Lily', 'Mason', 'Nora',
  'Oscar', 'Penny', 'Quincy', 'Riley', 'Sophia', 'Theodore', 'Ursula', 'Vincent',
  'Willow', 'Yuki',
];

// Generate up to 150 unique names by cycling the base pool with suffixes
function generateNames(count: number): string[] {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    if (i < BASE_NAMES.length) {
      names.push(BASE_NAMES[i]);
    } else {
      const cycle = Math.floor(i / BASE_NAMES.length);
      const base = BASE_NAMES[i % BASE_NAMES.length];
      names.push(`${base} ${cycle + 1}`);
    }
  }
  return names;
}

const PARTICIPANT_COLORS = [
  'from-blue-500 to-blue-700',
  'from-emerald-500 to-emerald-700',
  'from-purple-500 to-purple-700',
  'from-orange-500 to-orange-700',
  'from-pink-500 to-pink-700',
  'from-cyan-500 to-cyan-700',
  'from-yellow-500 to-yellow-700',
  'from-red-500 to-red-700',
  'from-indigo-500 to-indigo-700',
  'from-teal-500 to-teal-700',
  'from-rose-500 to-rose-700',
  'from-lime-500 to-lime-700',
  'from-amber-500 to-amber-700',
  'from-fuchsia-500 to-fuchsia-700',
];

// Build participant list dynamically from count
function buildParticipants(count: number) {
  const names = generateNames(count);
  return names.map((name, i) => ({
    id: `p${i}`,
    name,
    color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
  }));
}

// --- Avatar tile (no video, just initials) ---
function AvatarTile({ name, color, speaking }: { name: string; color: string; speaking: boolean }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className="relative aspect-video rounded-xl overflow-hidden bg-surface-800 group">
      <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-80`} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-black/30 flex items-center justify-center text-white text-2xl font-bold backdrop-blur-sm">
          {initials}
        </div>
      </div>
      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/50 text-white text-xs flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${speaking ? 'bg-emerald-400 animate-pulse' : 'bg-surface-400'}`} />
        {name}
      </div>
      {speaking && <div className="absolute inset-0 ring-2 ring-emerald-400 rounded-xl pointer-events-none" />}
    </div>
  );
}

// --- Local camera tile ---
function CameraTile({ stream, muted, speaking }: { stream: MediaStream | null; muted: boolean; speaking: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative aspect-video rounded-xl overflow-hidden bg-black group">
      {stream && !muted ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover -scale-x-100"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700">
          <div className="w-20 h-20 rounded-full bg-black/30 flex items-center justify-center text-white text-2xl font-bold">
            ME
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/50 text-white text-xs flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${speaking ? 'bg-emerald-400 animate-pulse' : 'bg-surface-400'}`} />
        You (Test Host)
      </div>
    </div>
  );
}

// --- Shared whiteboard types and state ---
const WHITEBOARD_BG = '#0f172a';
const WHITEBOARD_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#ffffff', '#f97316'];
const BRUSH_SIZES = [2, 5, 12];
const REF_WIDTH = 1600;

type Point = { x: number; y: number }; // normalized 0–1 relative to canvas display size
type Stroke = {
  id: string;
  points: Point[];
  color: string;
  size: number; // pixel width at REF_WIDTH
  isEraser: boolean;
};

type WhiteboardState = {
  strokes: Stroke[];
  activeStroke: Stroke | null;
  beginStroke: (x: number, y: number, color: string, size: number, isEraser: boolean) => void;
  extendStroke: (x: number, y: number) => void;
  commitStroke: () => void;
  clear: () => void;
};

/** Lifted whiteboard state shared between main page canvas and PiP canvas. */
function useWhiteboardState(): WhiteboardState {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const activeRef = useRef<Stroke | null>(null);

  const beginStroke = useCallback(
    (x: number, y: number, color: string, size: number, isEraser: boolean) => {
      const s: Stroke = {
        id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        points: [{ x, y }],
        color: isEraser ? WHITEBOARD_BG : color,
        size: isEraser ? size * 4 : size,
        isEraser,
      };
      activeRef.current = s;
      setActiveStroke(s);
    },
    [],
  );

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

/**
 * Renders the shared strokes onto a <canvas> and forwards pointer events
 * as normalized [0,1] coordinates.  Both the main-page whiteboard and the
 * PiP whiteboard use this component so drawings stay in sync.
 */
function SharedCanvas({
  width,
  height,
  strokes,
  activeStroke,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  width: number;
  height: number;
  strokes: Stroke[];
  activeStroke: Stroke | null;
  onPointerDown: (x: number, y: number) => void;
  onPointerMove: (x: number, y: number) => void;
  onPointerUp: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Re-render all strokes whenever they change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = WHITEBOARD_BG;
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
      width={width}
      height={height}
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

// --- Main whiteboard (full toolbar) ---
function WhiteboardCanvas({ wb, onClose }: { wb: WhiteboardState; onClose: () => void }) {
  const [color, setColor] = useState(WHITEBOARD_COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);

  return (
    <div className="h-full flex flex-col bg-surface-900">
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-800 border-b border-surface-700 flex-wrap">
        <div className="flex items-center gap-1">
          {WHITEBOARD_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setIsEraser(false); }}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                color === c && !isEraser ? 'border-white scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <div className="w-px h-6 bg-surface-600" />
        <div className="flex items-center gap-1">
          {BRUSH_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setBrushSize(s)}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                brushSize === s ? 'bg-brand-500' : 'bg-surface-600 hover:bg-surface-500'
              }`}
              aria-label={`Brush size ${s}`}
            >
              <span className="rounded-full bg-white" style={{ width: Math.max(s + 2, 4), height: Math.max(s + 2, 4) }} />
            </button>
          ))}
        </div>
        <div className="w-px h-6 bg-surface-600" />
        <button
          onClick={() => setIsEraser(!isEraser)}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
            isEraser ? 'bg-brand-500 text-white' : 'bg-surface-600 hover:bg-surface-500 text-surface-200'
          }`}
          aria-label="Eraser"
        >
          <Eraser className="w-4 h-4" />
        </button>
        <button
          onClick={wb.clear}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-600 hover:bg-red-500 text-surface-200 transition-colors"
          aria-label="Clear board"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="px-3 py-1 rounded-lg bg-surface-600 hover:bg-surface-500 text-surface-200 text-xs font-medium"
        >
          Close Whiteboard
        </button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <SharedCanvas
          width={1600}
          height={900}
          strokes={wb.strokes}
          activeStroke={wb.activeStroke}
          onPointerDown={(x, y) => wb.beginStroke(x, y, color, brushSize, isEraser)}
          onPointerMove={wb.extendStroke}
          onPointerUp={wb.commitStroke}
        />
      </div>
    </div>
  );
}

// --- Compact whiteboard for PiP ---
function PiPWhiteboard({ wb }: { wb: WhiteboardState }) {
  const [color, setColor] = useState(WHITEBOARD_COLORS[0]);
  const [isEraser, setIsEraser] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Compact toolbar */}
      <div className="flex items-center gap-1 px-1.5 py-1 bg-surface-800 border-b border-surface-700 shrink-0">
        {WHITEBOARD_COLORS.slice(0, 5).map((c) => (
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
      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <SharedCanvas
          width={1600}
          height={900}
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

// --- PiP local video element ---
function PiPLocalVideo({ stream }: { stream: MediaStream | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) return null;
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover -scale-x-100"
    />
  );
}

// --- PiP window content ---
function PiPContent({
  participants,
  micOn,
  cameraOn,
  whiteboardOn,
  wb,
  onToggleMic,
  onToggleCamera,
  onToggleWhiteboard,
  onToggleParticipantCamera,
  onClose,
}: {
  participants: Participant[];
  micOn: boolean;
  cameraOn: boolean;
  whiteboardOn: boolean;
  wb: WhiteboardState;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleWhiteboard: () => void;
  onToggleParticipantCamera: (id: string) => void;
  onClose: () => void;
}) {
  // Active speaker = speaking AND camera on.
  // If the current speaker has camera off, fall back to next participant with camera on.
  const activeSpeaker =
    participants.find((p) => p.speaking && !p.cameraOff) ??
    participants.find((p) => p.speaking) ??
    participants.find((p) => !p.cameraOff) ??
    participants.find((p) => p.isLocal) ??
    participants[0];
  // When whiteboard is enabled, user can toggle between whiteboard view and grid view
  const [showWhiteboardView, setShowWhiteboardView] = useState(true);
  useEffect(() => {
    if (whiteboardOn) setShowWhiteboardView(true);
  }, [whiteboardOn]);

  const others = participants.filter((p) => p.id !== activeSpeaker.id);

  const renderTile = (p: Participant, large: boolean) => {
    const showVideo = p.isLocal && !p.cameraOff && p.stream;
    const initials = p.name.slice(0, 2).toUpperCase();
    const avatarSize = large ? 'w-16 h-16 text-xl' : 'w-7 h-7 text-[10px]';

    return (
      <div
        key={p.id}
        className={`relative overflow-hidden bg-black ${
          large ? 'w-full h-full' : 'w-full h-14 shrink-0 rounded-md'
        }`}
      >
        {showVideo ? (
          <PiPLocalVideo stream={p.stream!} />
        ) : (
          <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${p.color}`}>
            <div className={`${avatarSize} rounded-full bg-black/30 flex items-center justify-center text-white font-bold`}>
              {initials}
            </div>
          </div>
        )}
        <div className={`absolute bottom-0.5 left-0.5 px-1 py-0.5 rounded bg-black/60 text-white flex items-center gap-1 ${large ? 'text-[11px]' : 'text-[9px]'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${p.speaking ? 'bg-emerald-400 animate-pulse' : 'bg-surface-500'}`} />
          {p.isLocal ? 'You' : p.name}
        </div>
        {p.speaking && (
          <div className={`absolute inset-0 ring-2 ring-emerald-400 ${large ? '' : 'rounded-md'} pointer-events-none`} />
        )}
        {/* Camera toggle on filmstrip tiles */}
        {!large && (
          <button
            onClick={() => onToggleParticipantCamera(p.id)}
            aria-label={p.cameraOff ? `Turn on ${p.name}'s camera` : `Turn off ${p.name}'s camera`}
            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
          >
            {p.cameraOff ? <VideoOff className="w-3 h-3 text-red-400" /> : <Video className="w-3 h-3" />}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-surface-900">
      {whiteboardOn && showWhiteboardView ? (
        <PiPWhiteboard wb={wb} />
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Active speaker — large, fills main area */}
          <div className="flex-1 relative overflow-hidden bg-black min-h-0">
            {renderTile(activeSpeaker, true)}
          </div>

          {/* Vertical filmstrip — hidden when only host remains */}
          {others.length > 0 && (
            <div
              className="w-[83px] flex flex-col gap-1.5 p-1.5 bg-surface-950 overflow-y-auto"
              style={{ maxHeight: '100%' }}
            >
              {others.map((p) => renderTile(p, false))}
            </div>
          )}
        </div>
      )}

      {/* Compact controls */}
      <div className="flex items-center justify-center gap-2 p-2 bg-surface-800">
        <button
          onClick={onToggleMic}
          aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            micOn ? 'bg-surface-600 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>
        <button
          onClick={onToggleCamera}
          aria-label={cameraOn ? 'Turn off camera' : 'Turn on camera'}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            cameraOn ? 'bg-surface-600 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {cameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </button>
        {whiteboardOn && (
          <button
            onClick={() => setShowWhiteboardView((v) => !v)}
            aria-label={showWhiteboardView ? 'Switch to grid view' : 'Switch to whiteboard view'}
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

// --- Main page ---
export default function PiPTestPage() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [camError, setCamError] = useState<string | null>(null);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string>('bob');
  const [cameraOffIds, setCameraOffIds] = useState<Set<string>>(new Set());
  const [participantCount, setParticipantCount] = useState(5);

  const { pipWindow, isSupported, togglePiP, closePiP, error: pipError } = usePiP();
  const wb = useWhiteboardState();

  const fakeParticipants = useMemo(() => buildParticipants(participantCount), [participantCount]);

  const toggleParticipantCamera = useCallback((id: string) => {
    setCameraOffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Simulate rotating active speaker every 4s for testing
  useEffect(() => {
    const ids = ['local', ...fakeParticipants.map((p) => p.id)];
    // If only host remains, just set local as speaker — no rotation needed
    if (ids.length === 1) {
      setActiveSpeakerId('local');
      return;
    }
    if (!ids.includes(activeSpeakerId)) {
      setActiveSpeakerId(ids[Math.min(1, ids.length - 1)]);
    }
    let i = Math.max(0, ids.indexOf(activeSpeakerId));
    const interval = setInterval(() => {
      i = (i + 1) % ids.length;
      setActiveSpeakerId(ids[i]);
    }, 4000);
    return () => clearInterval(interval);
  }, [fakeParticipants]);

  // Acquire local camera
  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => {
        if (active) setStream(s);
      })
      .catch((err) => {
        if (active) setCamError(err.message || 'Camera access denied');
      });
    return () => {
      active = false;
    };
  }, []);

  // Stop tracks on unmount
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const toggleMic = useCallback(() => {
    setMicOn((prev) => {
      const next = !prev;
      stream?.getAudioTracks().forEach((t) => (t.enabled = next));
      return next;
    });
  }, [stream]);

  const toggleCamera = useCallback(() => {
    setCameraOn((prev) => {
      const next = !prev;
      stream?.getVideoTracks().forEach((t) => (t.enabled = next));
      return next;
    });
  }, [stream]);

  // Build participants list for PiP
  const pipParticipants: Participant[] = useMemo(() => [
    {
      id: 'local',
      name: 'You',
      isLocal: true,
      speaking: activeSpeakerId === 'local',
      color: 'from-brand-500 to-brand-700',
      stream,
      cameraOff: !cameraOn,
    },
    ...fakeParticipants.map((p) => ({
      id: p.id,
      name: p.name,
      isLocal: false,
      speaking: p.id === activeSpeakerId,
      color: p.color,
      cameraOff: cameraOffIds.has(p.id),
    })),
  ], [stream, cameraOn, activeSpeakerId, cameraOffIds, fakeParticipants]);

  return (
    <div className="fixed inset-0 flex flex-col bg-surface-900" style={{ height: '100dvh' }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-surface-800 border-b border-surface-700">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <h1 className="text-white text-sm font-medium">PiP Test Lab</h1>
          <span className="text-surface-500 text-xs ml-2">
            {stream ? 'Camera: Connected' : camError ? 'Camera: Error' : 'Camera: Requesting...'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {pipError && <span className="text-red-400 text-xs">{pipError}</span>}
          {!isSupported && (
            <span className="text-yellow-400 text-xs">PiP not supported in this browser</span>
          )}
          {/* Participant count control */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-700 border border-surface-600">
            <Users className="w-3.5 h-3.5 text-surface-400" />
            <button
              onClick={() => setParticipantCount((c) => Math.max(0, c - 1))}
              disabled={participantCount <= 0}
              className="w-6 h-6 rounded flex items-center justify-center bg-surface-600 hover:bg-surface-500 text-white disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Remove participant"
            >
              −
            </button>
            <span className="text-white text-sm font-medium w-6 text-center tabular-nums">{participantCount}</span>
            <button
              onClick={() => setParticipantCount((c) => Math.min(150, c + 1))}
              disabled={participantCount >= 150}
              className="w-6 h-6 rounded flex items-center justify-center bg-surface-600 hover:bg-surface-500 text-white disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Add participant"
            >
              +
            </button>
          </div>
          <button
            onClick={togglePiP}
            disabled={!isSupported}
            aria-label={pipWindow ? 'Exit picture-in-picture' : 'Enter picture-in-picture'}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors ${
              pipWindow
                ? 'bg-brand-500 text-white hover:bg-brand-600'
                : 'bg-surface-600 text-surface-200 hover:bg-surface-500'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <PictureInPicture2 className="w-4 h-4" />
            {pipWindow ? 'PiP Active' : 'Open PiP'}
          </button>
        </div>
      </header>

      {/* Participant grid OR whiteboard */}
      <main className="flex-1 overflow-hidden">
        {whiteboardOpen ? (
          <WhiteboardCanvas wb={wb} onClose={() => setWhiteboardOpen(false)} />
        ) : (
          <div className="h-full overflow-auto p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl mx-auto">
              <CameraTile stream={stream} muted={!cameraOn} speaking={activeSpeakerId === 'local'} />
              {fakeParticipants.map((p) => (
                <AvatarTile key={p.id} name={p.name} color={p.color} speaking={p.id === activeSpeakerId} />
              ))}
            </div>

            {/* Info panel */}
            <div className="max-w-5xl mx-auto mt-6 p-4 rounded-xl bg-surface-800 border border-surface-700">
              <h2 className="text-surface-200 text-sm font-medium mb-2">Test Checklist</h2>
              <ul className="text-surface-400 text-xs space-y-1">
                <li>1. Click "Open PiP" — floating window shows active speaker on top + others below</li>
                <li>2. Active speaker rotates every 4s — PiP updates who's shown large</li>
                <li>3. Switch tabs — PiP stays visible, video keeps playing</li>
                <li>4. Use mute/camera/whiteboard buttons inside the PiP window</li>
                <li>5. Draw on whiteboard — strokes sync between main page and PiP window</li>
                <li>6. Close PiP window (X) — main view unaffected</li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Control bar */}
      <footer className="flex items-center justify-center gap-3 px-4 py-3 bg-surface-800 border-t border-surface-700">
        <button
          onClick={toggleMic}
          aria-label={micOn ? 'Mute' : 'Unmute'}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
            micOn ? 'bg-surface-600 hover:bg-surface-500 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
        >
          {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>
        <button
          onClick={toggleCamera}
          aria-label={cameraOn ? 'Turn off camera' : 'Turn on camera'}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
            cameraOn ? 'bg-surface-600 hover:bg-surface-500 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
        >
          {cameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>
        <button disabled className="w-11 h-11 rounded-full flex items-center justify-center bg-surface-600 text-surface-500 cursor-not-allowed">
          <Monitor className="w-5 h-5" />
        </button>
        <button disabled className="w-11 h-11 rounded-full flex items-center justify-center bg-surface-600 text-surface-500 cursor-not-allowed">
          <MessageSquare className="w-5 h-5" />
        </button>
        <button disabled className="w-11 h-11 rounded-full flex items-center justify-center bg-surface-600 text-surface-500 cursor-not-allowed">
          <Users className="w-5 h-5" />
        </button>
        <button disabled className="w-11 h-11 rounded-full flex items-center justify-center bg-surface-600 text-surface-500 cursor-not-allowed">
          <Settings className="w-5 h-5" />
        </button>
        <div className="w-px h-8 bg-surface-600 mx-1" />
        <button
          onClick={() => setWhiteboardOpen((prev) => !prev)}
          aria-label={whiteboardOpen ? 'Close whiteboard' : 'Open whiteboard'}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
            whiteboardOpen ? 'bg-brand-500 text-white' : 'bg-surface-600 hover:bg-surface-500 text-surface-200'
          }`}
        >
          <Pencil className="w-5 h-5" />
        </button>
        <button
          onClick={togglePiP}
          disabled={!isSupported}
          aria-label="Toggle PiP"
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
            pipWindow ? 'bg-brand-500 text-white' : 'bg-surface-600 hover:bg-surface-500 text-surface-200'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <PictureInPicture2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => { stream?.getTracks().forEach((t) => t.stop()); window.history.back(); }}
          className="w-11 h-11 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
          aria-label="Leave"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </footer>

      {/* PiP window portal */}
      {pipWindow &&
        createPortal(
          <PiPContent
            participants={pipParticipants}
            micOn={micOn}
            cameraOn={cameraOn}
            whiteboardOn={whiteboardOpen}
            wb={wb}
            onToggleMic={toggleMic}
            onToggleCamera={toggleCamera}
            onToggleWhiteboard={() => setWhiteboardOpen((prev) => !prev)}
            onToggleParticipantCamera={toggleParticipantCamera}
            onClose={closePiP}
          />,
          pipWindow.document.body,
        )}
    </div>
  );
}
