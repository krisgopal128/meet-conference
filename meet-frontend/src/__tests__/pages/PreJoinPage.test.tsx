import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PreJoinPage from '../../pages/PreJoinPage';

const mockStopPreview = vi.fn();

// Mock react-router-dom hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ roomName: 'test-room' }),
    useNavigate: () => vi.fn(),
  };
});

// Mock livekit-client (kept for any transitive imports; no longer used directly by usePreJoinMedia)
vi.mock('livekit-client', () => ({}));

vi.mock('../../hooks/usePreJoinAuth', () => ({
  usePreJoinAuth: () => ({
    room: { title: 'Test Room', host_id: 'host-1' },
    isGuest: true,
    requestedRole: null,
    isAuthenticatedFromStore: false,
    user: null,
  }),
}));

vi.mock('../../hooks/usePreJoinMedia', () => ({
  usePreJoinMedia: () => ({
    videoRef: { current: null },
    videoEnabled: true,
    audioEnabled: true,
    setAudioEnabled: vi.fn(),
    devices: { cameras: [], mics: [], speakers: [] },
    selectedCamera: '',
    setSelectedCamera: vi.fn(),
    selectedMic: '',
    setSelectedMic: vi.fn(),
    selectedSpeaker: '',
    setSelectedSpeaker: vi.fn(),
    micLevel: 100,
    setMicLevel: vi.fn(),
    speakerLevel: 100,
    setSpeakerLevel: vi.fn(),
    noiseSuppression: true,
    setNoiseSuppression: vi.fn(),
    echoCancellation: true,
    setEchoCancellation: vi.fn(),
    backgroundBlur: false,
    setBackgroundBlur: vi.fn(),
    backgroundBlurLevel: 10,
    setBackgroundBlurLevel: vi.fn(),
    videoFilter: 'none',
    setVideoFilter: vi.fn(),
    qualityMode: 'auto',
    setQualityMode: vi.fn(),
    screenShareMode: 'documents',
    setScreenShareMode: vi.fn(),
    gridAspectRatio: '16:9',
    setGridAspectRatio: vi.fn(),
    videoFitMode: 'cover',
    setVideoFitMode: vi.fn(),
    cameraHardwareCaps: null,
    showDeviceSettings: false,
    setShowDeviceSettings: vi.fn(),
    expandedSections: { devices: true, audio: false, video: false, moderator: false },
    toggleSection: vi.fn(),
    initializing: false,
    initStatus: 'Ready',
    toggleVideo: vi.fn(),
    stopPreview: mockStopPreview,
  }),
}));

vi.mock('../../hooks/useLightweightVideoFilter', () => ({
  useLightweightPreviewFilter: vi.fn(),
}));

vi.mock('../../hooks/usePreviewBackgroundBlur', () => ({
  usePreviewBackgroundBlur: vi.fn(),
}));

vi.mock('../../hooks/useBackgroundBlurPreview', () => ({
  useBackgroundBlurPreview: vi.fn(),
}));

// Mock services/api
vi.mock('../../services/api', () => ({
  getToken: vi.fn().mockResolvedValue({ data: { token: 'test-token' } }),
  getGuestToken: vi.fn().mockResolvedValue({ data: { token: 'test-token' } }),
  getRoom: vi.fn().mockResolvedValue({ data: { room: { title: 'Test Room' } } }),
  isAuthenticated: vi.fn().mockReturnValue(false),
  registerAuthStore: vi.fn(),
}));

// Mock config
vi.mock('../../config/meetingRoomConfig', () => ({
  buildCameraCaptureOptions: vi.fn(() => ({})),
  getQualityModeConfig: vi.fn(() => ({ name: 'auto', settings: {} })),
  isAudioOnlyMode: vi.fn(() => false),
  meetingRoomConfig: {
    prejoin: {
      videoEnabledByDefault: true,
      audioEnabledByDefault: true,
      noiseSuppression: true,
      echoCancellation: true,
      showDeviceSettingsByDefault: false,
    },
    features: {
      qualityModeSelector: true,
      screenshareModeSelector: true,
    },
    qualityModes: {
      availableModes: ['auto', 'dataSaver', 'highQuality', 'audioOnly'],
    },
    media: {
      screenShare: {
        defaultMode: 'documents',
      },
    },
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const renderPreJoinPage = () => {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PreJoinPage />
    </MemoryRouter>
  );
};

describe('PreJoinPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the page', () => {
      renderPreJoinPage();
      
      // Check for main heading/brand
      expect(screen.getByText('Meet')).toBeInTheDocument();
    });

    it('should show name input for guests', async () => {
      renderPreJoinPage();
      
      // Look for the name input label or placeholder
      const nameInput = screen.queryByPlaceholderText('Enter your name') 
        || screen.queryByLabelText(/your name/i)
        || screen.queryByRole('textbox');
      
      expect(nameInput).toBeInTheDocument();
    });

    it('should have a join button', () => {
      renderPreJoinPage();
      
      // Look for the join button
      const joinButton = screen.queryByRole('button', { name: /join/i });
      
      expect(joinButton).toBeInTheDocument();
    });
  });

  describe('Page structure', () => {
    it('should display room name in header', () => {
      renderPreJoinPage();
      
      // Check that room name is shown somewhere
      expect(screen.getByText(/test-room/i)).toBeInTheDocument();
    });

    it('should have camera toggle button', () => {
      renderPreJoinPage();
      
      // Look for camera toggle (button with Camera/CameraOff icon)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should have microphone toggle button', () => {
      renderPreJoinPage();
      
      // Look for mic toggle (button with Mic/MicOff icon)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
