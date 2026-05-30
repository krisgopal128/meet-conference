import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RoomPage from '../../pages/RoomPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ roomName: 'test-room' }),
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      state: {
        token: 'test-token',
        videoEnabled: true,
        audioEnabled: true,
        role: 'attendee',
      },
    }),
  };
});

vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="livekit-room">{children}</div>
  ),
  useLocalParticipant: () => ({
    localParticipant: {
      identity: 'test-user',
      isCameraEnabled: false,
      isMicrophoneEnabled: false,
      isScreenShareEnabled: false,
      permissions: { canPublish: true },
      setCameraEnabled: vi.fn().mockResolvedValue(undefined),
      setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
      setScreenShareEnabled: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
      trackPublications: [],
      videoTrackPublications: [],
      audioTrackPublications: [],
    },
  }),
  useRoomContext: () => ({
    localParticipant: {
      identity: 'test-user',
      isCameraEnabled: false,
      isMicrophoneEnabled: false,
      isScreenShareEnabled: false,
      permissions: { canPublish: true },
      setCameraEnabled: vi.fn().mockResolvedValue(undefined),
      setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
      setScreenShareEnabled: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
      trackPublications: [],
      videoTrackPublications: [],
      audioTrackPublications: [],
    },
    switchActiveDevice: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
  }),
  useConnectionState: () => 'connected',
  ConnectionState: { Connected: 'connected', Disconnected: 'disconnected', Connecting: 'connecting' },
  useTracks: () => [],
  useParticipants: () => [],
}));

vi.mock('livekit-client', () => ({
  VideoPreset: class {
    constructor() {}
  },
}));

vi.mock('../../services/api', () => ({
  registerAuthStore: vi.fn(),
  getRoomSettings: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../utils/blurProcessorManager', () => ({
  enableBlur: vi.fn().mockResolvedValue(true),
  disableBlur: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../store/roomStore', () => ({
  useConnectionActions: () => ({
    setConnected: vi.fn(),
    reset: vi.fn(),
    setToken: vi.fn(),
    setHostId: vi.fn(),
    setRole: vi.fn(),
    setDisplayName: vi.fn(),
    setPrejoinDevices: vi.fn(),
  }),
  useUIActions: () => ({
    setQualityMode: vi.fn(),
    setScreenShareMode: vi.fn(),
    setGridAspectRatio: vi.fn(),
    setVideoFitMode: vi.fn(),
    setBackgroundBlurEnabled: vi.fn(),
    toggleBackgroundBlur: vi.fn(),
  }),
  useQualityMode: () => 'auto',
  useScreenShareMode: () => 'documents',
  useGridAspectRatio: () => '16:9',
  useBackgroundBlurEnabled: () => false,
}));

vi.mock('../../config/meetingRoomConfig', () => ({
  buildCameraCaptureOptions: vi.fn(() => ({})),
  buildAudioCaptureOptions: vi.fn(() => ({})),
  getAdaptiveStreamOptions: vi.fn(() => ({})),
  getQualityModeConfig: vi.fn(() => ({ name: 'auto', settings: {} })),
  getScreenShareOptions: vi.fn(() => ({
    resolution: { width: 1920, height: 1080 },
    encoding: { maxBitrate: 3000000, maxFramerate: 30 },
  })),
  getVideoSimulcastLayers: vi.fn(() => []),
  isAudioOnlyMode: vi.fn(() => false),
  resolveAudioPreset: vi.fn(),
  resolveBackupCodecPolicy: vi.fn(),
  meetingRoomConfig: {
    prejoin: {
      videoEnabledByDefault: true,
      audioEnabledByDefault: true,
      noiseSuppression: true,
      echoCancellation: true,
    },
    room: {
      dynacast: true,
    },
    media: {
      publishDefaults: {
        simulcast: true,
        videoCodec: 'vp',
        backupCodec: true,
        dtx: true,
        red: true,
        forceStereo: false,
        scalabilityMode: 'L3T3',
        degradationPreference: 'balanced',
        videoEncoding: { maxBitrate: 2000000, maxFramerate: 30 },
      },
      simulcastLayers: {
        high: { maxBitrate: 3000000 },
      },
    },
  },
}));

vi.mock('../../components/room/ConferenceRoom', () => ({
  ConferenceRoom: () => (
    <div data-testid="conference-room">
      <div data-testid="control-bar">Control Bar Area</div>
    </div>
  ),
}));

vi.mock('../../components/room/LobbyWaiting', () => ({
  LobbyWaiting: ({ roomName }: { roomName?: string }) => (
    <div data-testid="lobby-waiting">Waiting in lobby for {roomName}</div>
  ),
}));

vi.stubEnv('VITE_LIVEKIT_URL', 'wss://test.livekit.cloud');

const renderRoomPage = async () => {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <MemoryRouter>
        <RoomPage />
      </MemoryRouter>
    );
  });
  await act(async () => {
    vi.advanceTimersByTime(600);
  });
  return result!;
};

describe('RoomPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render the page', async () => {
      await renderRoomPage();

      expect(screen.getByTestId('livekit-room')).toBeInTheDocument();
    });

    it('should show control bar area', async () => {
      await renderRoomPage();

      expect(screen.getByTestId('control-bar')).toBeInTheDocument();
    });
  });

  describe('Page structure', () => {
    it('should render the LiveKit room wrapper', async () => {
      await renderRoomPage();

      const liveKitRoom = screen.getByTestId('livekit-room');
      expect(liveKitRoom).toBeInTheDocument();
    });

    it('should render conference room content', async () => {
      await renderRoomPage();

      const conferenceRoom = screen.getByTestId('conference-room');
      expect(conferenceRoom).toBeInTheDocument();
    });
  });
});
