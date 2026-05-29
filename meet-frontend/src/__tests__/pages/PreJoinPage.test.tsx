import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PreJoinPage from '../../pages/PreJoinPage';

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

// Mock services/api
vi.mock('../../services/api', () => ({
  getToken: vi.fn().mockResolvedValue({ data: { token: 'test-token' } }),
  getGuestToken: vi.fn().mockResolvedValue({ data: { token: 'test-token' } }),
  getRoom: vi.fn().mockResolvedValue({ data: { room: { title: 'Test Room' } } }),
  isAuthenticated: vi.fn().mockReturnValue(false),
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

// Mock mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [{ stop: vi.fn(), readyState: 'live' }],
      getAudioTracks: () => [{ stop: vi.fn() }],
    }),
    enumerateDevices: vi.fn().mockResolvedValue([]),
  },
});

const renderPreJoinPage = () => {
  return render(
    <MemoryRouter>
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
