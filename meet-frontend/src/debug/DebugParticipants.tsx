/**
 * Debug Participants — Adds dummy participant tiles for testing.
 *
 * Dummy tiles clone the local camera video track so you can test
 * multi-participant layouts, PiP rendering, and video display without
 * needing real remote participants.
 *
 * Usage:
 *   - Wrap your tree with <DebugParticipantsProvider>
 *   - Use <DebugBar /> for +/− buttons
 *   - Use <DummyParticipantTile name="..." /> to render a dummy tile
 *   - Use useDebugParticipants() to read the current dummy list
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, LogOut, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Dummy name pool ───

const DUMMY_NAMES = [
  'Alice Chen',
  'Bob Smith',
  'Charlie Davis',
  'Diana Lopez',
  'Eve Martin',
  'Frank Wang',
  'Grace Kim',
  'Henry Park',
  'Iris Nair',
  'Jack Roy',
  'Karen Lee',
  'Liam Das',
];

// ─── Context ───

export interface DummyParticipant {
  identity: string;
  name: string;
}

export interface DummyState {
  muted: boolean;
  cameraOff: boolean;
  screenShareOff: boolean;
}

interface DebugCtx {
  count: number;
  names: string[];
  dummyParticipants: DummyParticipant[];
  dummyStates: Record<string, DummyState>;
  addOne: () => void;
  removeOne: () => void;
  muteDummy: (identity: string) => void;
  disableDummyCamera: (identity: string) => void;
  disableDummyScreenShare: (identity: string) => void;
  kickDummy: (identity: string) => void;
}

const Ctx = createContext<DebugCtx>({
  count: 0,
  names: [],
  dummyParticipants: [],
  dummyStates: {},
  addOne: () => {},
  removeOne: () => {},
  muteDummy: () => {},
  disableDummyCamera: () => {},
  disableDummyScreenShare: () => {},
  kickDummy: () => {},
});

export function useDebugParticipants(): DebugCtx {
  return useContext(Ctx);
}

export function DebugParticipantsProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const [dummyStates, setDummyStates] = useState<Record<string, DummyState>>({});
  const [kicked, setKicked] = useState<Set<string>>(new Set());

  const addOne = useCallback(() => setCount((c) => Math.min(c + 1, DUMMY_NAMES.length)), []);

  const removeOne = useCallback(() => {
    setCount((c) => {
      const next = Math.max(c - 1, 0);
      // Clean up state for the removed index
      const removedId = `dummy-${next}`;
      setDummyStates((prev) => {
        const copy = { ...prev };
        delete copy[removedId];
        return copy;
      });
      return next;
    });
  }, []);

  const getDummyName = useCallback((identity: string): string => {
    const idx = DUMMY_NAMES.findIndex((_, i) => `dummy-${i}` === identity);
    return idx >= 0 ? DUMMY_NAMES[idx] : 'dummy';
  }, []);

  const muteDummy = useCallback((identity: string) => {
    setDummyStates((prev) => {
      if (prev[identity]?.muted) return prev;
      toast.success(`Muted ${getDummyName(identity)}`, { duration: 2000 });
      return {
        ...prev,
        [identity]: {
          muted: true,
          cameraOff: prev[identity]?.cameraOff ?? false,
          screenShareOff: prev[identity]?.screenShareOff ?? false,
        },
      };
    });
  }, [getDummyName]);

  const disableDummyCamera = useCallback((identity: string) => {
    setDummyStates((prev) => {
      if (prev[identity]?.cameraOff) return prev;
      toast.success(`Camera disabled for ${getDummyName(identity)}`, { duration: 2000 });
      return {
        ...prev,
        [identity]: {
          muted: prev[identity]?.muted ?? false,
          cameraOff: true,
          screenShareOff: prev[identity]?.screenShareOff ?? false,
        },
      };
    });
  }, [getDummyName]);

  const disableDummyScreenShare = useCallback((identity: string) => {
    setDummyStates((prev) => ({
      ...prev,
      [identity]: {
        muted: prev[identity]?.muted ?? false,
        cameraOff: prev[identity]?.cameraOff ?? false,
        screenShareOff: true,
      },
    }));
    toast.success('Screen share disabled', { duration: 2000 });
  }, []);

  const kickDummy = useCallback((identity: string) => {
    setKicked((prev) => {
      if (prev.has(identity)) return prev;
      toast.success(`Removed ${getDummyName(identity)}`, { duration: 2000 });
      return new Set(prev).add(identity);
    });
  }, [getDummyName]);

  const names = DUMMY_NAMES.slice(0, count);
  const dummyParticipants = useMemo<DummyParticipant[]>(
    () => DUMMY_NAMES.slice(0, count)
      .map((name, i) => ({ identity: `dummy-${i}`, name }))
      .filter((d) => !kicked.has(d.identity)),
    [count, kicked]
  );

  return (
    <Ctx.Provider value={{
      count, names, dummyParticipants, dummyStates,
      addOne, removeOne, muteDummy, disableDummyCamera, disableDummyScreenShare, kickDummy,
    }}>
      {children}
    </Ctx.Provider>
  );
}

// ─── Dummy tile — clones local camera video ───

interface DummyTileProps {
  name: string;
  /** "small" for filmstrip, "normal" for grid */
  size?: 'normal' | 'small';
  /** Current dummy state — controls mute/camera display */
  state?: DummyState;
}

export function DummyParticipantTile({ name, size = 'normal', state }: DummyTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { localParticipant } = useLocalParticipant();
  const [videoReady, setVideoReady] = useState(false);
  const isSmall = size === 'small';
  const cameraOff = state?.cameraOff ?? false;
  const muted = state?.muted ?? false;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let stream: MediaStream | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const setup = (): boolean => {
      const pub = localParticipant?.getTrackPublication(Track.Source.Camera);
      const track = pub?.track?.mediaStreamTrack;
      if (!track) return false;

      // Clone the local camera track so each dummy gets its own stream
      stream = new MediaStream([track.clone()]);
      video.srcObject = stream;
      void video.play().catch(() => {});
      return true;
    };

    if (!setup()) {
      // Retry until camera becomes available
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
    };
  }, [localParticipant]);

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`relative bg-gradient-to-br from-surface-700 to-surface-800 rounded-lg overflow-hidden ring-1 ring-warning-500/40 ${
        isSmall ? 'h-full w-full' : 'aspect-video w-full h-full'
      }`}
    >
      {/* Cloned local camera video — hidden when camera disabled */}
      {!cameraOff && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setVideoReady(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            videoReady ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transform: 'scaleX(-1)' }}
        />
      )}

      {/* Avatar — shown when camera is off or video not yet ready */}
      {(cameraOff || !videoReady) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`${
              isSmall ? 'w-8 h-8 text-xs' : 'w-16 h-16 text-xl'
            } rounded-full ${cameraOff ? 'bg-danger-600' : 'bg-surface-600'} flex items-center justify-center font-bold text-white transition-opacity duration-300 opacity-100`}
          >
            {initials}
          </div>
        </div>
      )}

      {/* Name label with robot indicator + mic indicator */}
      <div
        className={`absolute ${
          isSmall ? 'bottom-0.5 left-0.5' : 'bottom-1 left-1'
        } bg-black/70 rounded flex items-center gap-1 ${
          isSmall ? 'text-[8px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5'
        } text-white`}
      >
        <span>🤖</span>
        {muted && <MicOff className={isSmall ? 'w-2 h-2 text-danger-400' : 'w-3 h-3 text-danger-400'} />}
        <span className="truncate max-w-[60px]">{name}</span>
      </div>

      {/* Camera-off indicator badge */}
      {cameraOff && (
        <div className={`absolute ${isSmall ? 'top-0.5 right-0.5' : 'top-1 right-1'} bg-danger-500/80 rounded-full p-0.5`}>
          <VideoOff className={isSmall ? 'w-2 h-2 text-white' : 'w-3 h-3 text-white'} />
        </div>
      )}
    </div>
  );
}

// ─── List item for participant/chat panels ───

interface DummyListItemProps {
  identity: string;
  name: string;
  state: DummyState;
  isModerator: boolean;
  onMute: (identity: string) => void;
  onDisableCamera: (identity: string) => void;
  onDisableScreenShare: (identity: string) => void;
  onKick: (identity: string) => void;
}

export function DummyParticipantListItem({
  identity,
  name,
  state,
  isModerator,
  onMute,
  onDisableCamera,
  onDisableScreenShare,
  onKick,
}: DummyListItemProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg opacity-75 hover:bg-surface-700 transition-colors"
      data-dummy-identity={identity}
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-warning-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
        {initials}
      </div>

      {/* Name + DUMMY badge */}
      <div className="flex-1 min-w-0">
        <p className="text-surface-300 text-sm truncate flex items-center gap-1.5">
          <span className="truncate">{name}</span>
          <span className="text-[9px] bg-warning-500/20 text-warning-400 px-1 rounded font-bold uppercase tracking-wide shrink-0">
            Dummy
          </span>
        </p>
      </div>

      {/* Connection quality placeholder */}
      <div className="flex-shrink-0">
        <div className="flex items-center gap-0.5 h-3">
          <div className="w-1 h-2 bg-success-500 rounded-full" />
          <div className="w-1 h-3 bg-success-500 rounded-full" />
          <div className="w-1 h-2 bg-success-500 rounded-full" />
        </div>
      </div>

      {/* Mic / camera / screen-share / kick buttons */}
      <div className="flex items-center gap-1">
        {/* Mic button — moderator can click to mute */}
        {isModerator ? (
          <button
            onClick={() => onMute(identity)}
            disabled={state.muted}
            className="p-1.5 hover:bg-danger-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
            title="Mute participant"
          >
            {state.muted ? (
              <MicOff size={14} className="text-danger-400" />
            ) : (
              <Mic size={14} className="text-surface-500 group-hover:text-danger-400" />
            )}
          </button>
        ) : (
          <div className="p-1.5">
            {state.muted ? (
              <MicOff size={14} className="text-danger-400" />
            ) : (
              <Mic size={14} className="text-surface-500" />
            )}
          </div>
        )}

        {/* Camera button — moderator can click to disable */}
        {isModerator ? (
          <button
            onClick={() => onDisableCamera(identity)}
            disabled={state.cameraOff}
            className="p-1.5 hover:bg-danger-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
            title="Disable camera"
          >
            {state.cameraOff ? (
              <VideoOff size={14} className="text-danger-400" />
            ) : (
              <Video size={14} className="text-surface-500 group-hover:text-danger-400" />
            )}
          </button>
        ) : (
          <div className="p-1.5">
            {state.cameraOff ? (
              <VideoOff size={14} className="text-danger-400" />
            ) : (
              <Video size={14} className="text-surface-500" />
            )}
          </div>
        )}

        {/* Screen-share disable button (moderator only) */}
        {isModerator && (
          <button
            onClick={() => onDisableScreenShare(identity)}
            disabled={state.screenShareOff}
            className="p-1.5 hover:bg-surface-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
            title="Disable screen share"
          >
            <Monitor size={14} className={state.screenShareOff ? 'text-surface-600' : 'text-surface-400 group-hover:text-warning-400'} />
          </button>
        )}

        {/* Kick button (moderator only) */}
        {isModerator && (
          <button
            onClick={() => onKick(identity)}
            className="p-1.5 hover:bg-surface-600 rounded-lg transition-colors group"
            title="Remove from meeting"
          >
            <LogOut size={14} className="text-surface-400 group-hover:text-danger-400" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Debug bar — +/− buttons ───

export function DebugBar() {
  const { count, addOne, removeOne } = useDebugParticipants();

  return (
    <div className="absolute top-1 right-1 z-50 flex items-center gap-1 bg-surface-900/90 backdrop-blur-sm border border-warning-500/50 rounded-lg p-1 shadow-lg">
      <span className="text-[9px] text-warning-400 font-bold px-1 select-none">DUMMY</span>
      <button
        onClick={removeOne}
        disabled={count === 0}
        aria-label="Remove dummy participant"
        className="w-6 h-6 rounded bg-surface-700 hover:bg-surface-600 active:bg-surface-500 text-white text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
      >
        −
      </button>
      <span className="text-xs text-white font-bold w-4 text-center select-none">{count}</span>
      <button
        onClick={addOne}
        disabled={count >= DUMMY_NAMES.length}
        aria-label="Add dummy participant"
        className="w-6 h-6 rounded bg-surface-700 hover:bg-surface-600 active:bg-surface-500 text-white text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
      >
        +
      </button>
    </div>
  );
}
