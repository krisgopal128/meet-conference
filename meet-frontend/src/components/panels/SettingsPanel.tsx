import { useState, useEffect, useRef, useCallback } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import {
  useSettingsView,
  useMirrorLocalVideo,
  useQualityMode,
  useSelectedQualityMode,
  useScreenShareMode,
  useAutoFallbackActive,
  useConnectionQualityLabel,
  usePacketLossPercent,
  useRttMs,
  useJitterMs,
  useAvailableBitrateKbps,
  useDiagnosticsLog,
  useBatteryLevelPercent,
  useBatteryCharging,
  useQualityOverrideReason,
  useBackgroundBlurEnabled,
  useBackgroundBlurIntensity,
  useBackgroundMode,
  useBackgroundBgColor,
  useBackgroundImagePath,
  useGridAspectRatio,
  useVideoFitMode,
  useUIActions,
  useIsModerator,
  useRoomName,
} from '../../store/roomStore';
import { X, Video, Volume2, Activity, FlipHorizontal, Users, Grid3X3, Maximize2, Crop, SquareIcon, ChevronDown, ChevronRight, Shield, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { meetingRoomConfig, type QualityModeName, type ScreenShareModeName } from '../../config/meetingRoomConfig';
import { meetingsApi, updateRoomSettings } from '../../services/api';
import { withOperationTimeout } from '../../utils/asyncTimeout';
import logger from '../../utils/logger';

export function SettingsPanel() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  
  // Optimized selectors
  const settingsView = useSettingsView();
  const mirrorLocalVideo = useMirrorLocalVideo();
  const qualityMode = useQualityMode();
  const selectedQualityMode = useSelectedQualityMode();
  const screenShareMode = useScreenShareMode();
  const autoFallbackActive = useAutoFallbackActive();
  const connectionQualityLabel = useConnectionQualityLabel();
  const packetLossPercent = usePacketLossPercent();
  const rttMs = useRttMs();
  const jitterMs = useJitterMs();
  const availableBitrateKbps = useAvailableBitrateKbps();
  const diagnosticsLog = useDiagnosticsLog();
  const batteryLevelPercent = useBatteryLevelPercent();
  const batteryCharging = useBatteryCharging();
  const qualityOverrideReason = useQualityOverrideReason();
  const backgroundBlurEnabled = useBackgroundBlurEnabled();
  const backgroundBlurIntensity = useBackgroundBlurIntensity();
  const backgroundMode = useBackgroundMode();
  const backgroundBgColor = useBackgroundBgColor();
  const backgroundImagePath = useBackgroundImagePath();
  const gridAspectRatio = useGridAspectRatio();
  const videoFitMode = useVideoFitMode();
  const isModerator = useIsModerator();
  const roomName = useRoomName();

  // Action hooks
  const { toggleSettings, openSettingsView, toggleMirrorLocalVideo, toggleBackgroundBlur, setBackgroundBlurLevel, setBackgroundBlurIntensity, setBackgroundMode, setBackgroundBgColor, setBackgroundImagePath, setQualityMode, setScreenShareMode, setGridAspectRatio, setVideoFitMode, clearDiagnosticsLog } = useUIActions();
  
  const persistedSpeakerVolumeRef = useRef(100);
  const [speakerVolume, setSpeakerVolume] = useState(() => persistedSpeakerVolumeRef.current);
  const speakerVolumeRef = useRef(persistedSpeakerVolumeRef.current);

  const applyVolumeToAllRemoteParticipants = useCallback((volume: number) => {
    const normalizedVolume = volume / 100;
    room.remoteParticipants.forEach((participant) => {
      participant.audioTrackPublications.forEach((pub) => {
        if (pub.track) {
          (pub.track as any).setVolume?.(normalizedVolume);
        }
      });
    });
  }, [room]);

  const handleSpeakerVolumeChange = (value: number) => {
    setSpeakerVolume(value);
    speakerVolumeRef.current = value;
    persistedSpeakerVolumeRef.current = value;
    applyVolumeToAllRemoteParticipants(value);
  };

  useEffect(() => {
    const onTrackSubscribed = () => {
      applyVolumeToAllRemoteParticipants(speakerVolumeRef.current);
    };
    room.on('trackSubscribed', onTrackSubscribed);
    return () => {
      room.off('trackSubscribed', onTrackSubscribed);
    };
  }, [room, applyVolumeToAllRemoteParticipants]);

  const [uploadingDiagnostics, setUploadingDiagnostics] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMic, setSelectedMic] = useState('');
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    devices: true,
    meetingSettings: true,
  });
  
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  // Debounce timers for saving room settings (separate per setting to avoid clobbering)
  const saveAspectRatioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveVideoFitModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Persist aspect ratio to backend when changed (moderators only)
  const handleAspectRatioChange = async (ratio: '16:9' | '9:16' | '1:1' | '4:3') => {
    setGridAspectRatio(ratio);
    
    // Only moderators can save to backend
    if (!isModerator || !roomName) return;
    
    // Debounce the API call
    if (saveAspectRatioTimerRef.current) {
      clearTimeout(saveAspectRatioTimerRef.current);
    }
    
    saveAspectRatioTimerRef.current = setTimeout(async () => {
      try {
        await withOperationTimeout(
          updateRoomSettings(roomName, { gridAspectRatio: ratio }),
          'SETTINGS',
          'Save grid aspect ratio'
        );
        toast.success('Aspect ratio saved');
      } catch (error) {
        logger.error('Failed to save aspect ratio:', error);
        toast.error('Failed to save aspect ratio');
      }
    }, 500);
  };
  
  // Video fit mode is personal preference - updates local state immediately
  // Moderators can optionally save to backend for room-wide default
  // AND broadcast to other participants via data channel
  const handleVideoFitModeChange = (mode: 'cover' | 'contain') => {
    setVideoFitMode(mode);
    
    // Broadcast to other participants via data channel
    if (isModerator) {
      const message = {
        type: 'settings_sync',
        setting: 'videoFitMode',
        value: mode,
        senderIdentity: localParticipant.identity,
      };
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(message));
      
      // Broadcast to all participants
      room.localParticipant.publishData(data, { reliable: true });
      logger.info('[SettingsPanel] Broadcasting videoFitMode:', mode);
    }
    
    // Moderators can save to backend (debounced)
    if (roomName && isModerator) {
      if (saveVideoFitModeTimerRef.current) {
        clearTimeout(saveVideoFitModeTimerRef.current);
      }
      
      saveVideoFitModeTimerRef.current = setTimeout(() => {
        withOperationTimeout(
          updateRoomSettings(roomName, { videoFitMode: mode }),
          'SETTINGS',
          'Save video fit mode'
        )
          .then(() => toast.success('Video fit mode saved'))
          .catch((error) => {
            logger.error('Failed to save video fit mode:', error);
            toast.error('Failed to save video fit mode');
          });
      }, 500);
    }
  };

  // Clear debounce timers on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      if (saveAspectRatioTimerRef.current) clearTimeout(saveAspectRatioTimerRef.current);
      if (saveVideoFitModeTimerRef.current) clearTimeout(saveVideoFitModeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Load devices
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setCameras(devices.filter(d => d.kind === 'videoinput'));
      setMics(devices.filter(d => d.kind === 'audioinput'));
      setSelectedCamera(room.getActiveDevice('videoinput') || '');
      setSelectedMic(room.getActiveDevice('audioinput') || '');
    }).catch((err) => logger.error('Failed to enumerate devices:', err));
    const handleDeviceChange = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameras(devices.filter((device) => device.kind === 'videoinput'));
        setMics(devices.filter((device) => device.kind === 'audioinput'));
        setSelectedCamera(room.getActiveDevice('videoinput') || '');
        setSelectedMic(room.getActiveDevice('audioinput') || '');
      } catch (error) {
        logger.error('Failed to refresh devices:', error);
      }
    };

    const handleActiveDeviceChanged = (kind: 'audioinput' | 'videoinput' | 'audiooutput', deviceId: string) => {
      if (kind === 'videoinput') {
        setSelectedCamera(deviceId);
      }
      if (kind === 'audioinput') {
        setSelectedMic(deviceId);
      }
    };

    navigator.mediaDevices.addEventListener?.('devicechange', handleDeviceChange);
    room.on('activeDeviceChanged', handleActiveDeviceChanged);

    return () => {
      navigator.mediaDevices.removeEventListener?.('devicechange', handleDeviceChange);
      room.off('activeDeviceChanged', handleActiveDeviceChanged);
    };
  }, [room]);

  async function handleCameraChange(deviceId: string) {
    setSelectedCamera(deviceId);
    try {
      await withOperationTimeout(
        room.switchActiveDevice('videoinput', deviceId || 'default'),
        'DEVICE_SWITCH',
        'Switch camera device'
      );
    } catch (error) {
      logger.error('Failed to switch camera:', error);
      toast.error('Failed to switch camera');
    }
  }

  async function handleMicChange(deviceId: string) {
    setSelectedMic(deviceId);
    try {
      await withOperationTimeout(
        room.switchActiveDevice('audioinput', deviceId || 'default'),
        'DEVICE_SWITCH',
        'Switch microphone device'
      );
    } catch (error) {
      logger.error('Failed to switch microphone:', error);
      toast.error('Failed to switch microphone');
    }
  }

  const remoteParticipantCount = room.remoteParticipants.size;
  const connectionState = String(room.state);
  const callHealthTone =
    connectionState.toLowerCase() === 'connected'
      ? 'text-success-400'
      : connectionState.toLowerCase().includes('connect')
        ? 'text-warning-400'
        : 'text-danger-400';

  const diagnosticsSnapshot = {
    roomName: room.name,
    participantIdentity: localParticipant?.identity,
    selectedQualityMode,
    effectiveQualityMode: qualityMode,
    screenShareMode,
    autoFallbackActive,
    qualityOverrideReason,
    connectionQualityLabel,
    packetLossPercent,
    rttMs,
    jitterMs,
    availableBitrateKbps,
    batteryLevelPercent,
    batteryCharging,
    diagnosticsLog: diagnosticsLog.map(({ at, type, message }) => ({ at, type, message })),
    userAgent: navigator.userAgent,
    capturedAt: new Date().toISOString(),
  };

  function downloadDiagnostics() {
    const blob = new Blob([JSON.stringify(diagnosticsSnapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meeting-diagnostics-${room.name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Diagnostics downloaded');
  }

  async function uploadDiagnostics() {
    try {
      setUploadingDiagnostics(true);
      const response = await meetingsApi.uploadDiagnostics(diagnosticsSnapshot);
      toast.success(`Diagnostics uploaded: ${response.data.file}`);
    } catch (error) {
      logger.error('Failed to upload diagnostics:', error);
      toast.error('Failed to upload diagnostics');
    } finally {
      setUploadingDiagnostics(false);
    }
  }

  return (
    <div className="w-full md:w-72 flex flex-col bg-surface-800 md:border-l border-surface-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
        <span className="font-semibold text-surface-100">Settings</span>
        <button 
          onClick={toggleSettings} 
          className="hidden md:block p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors"
          aria-label="Close settings"
        >
          <X size={18} />
        </button>
      </div>
      
      {/* Settings */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => openSettingsView('devices')}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition ${settingsView === 'devices' ? 'bg-brand-500 text-white' : 'bg-surface-700 text-surface-300 hover:bg-surface-600'}`}
          >
            Devices
          </button>
          <button
            onClick={() => openSettingsView('call-health')}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition ${settingsView === 'call-health' ? 'bg-brand-500 text-white' : 'bg-surface-700 text-surface-300 hover:bg-surface-600'}`}
          >
            Call Health
          </button>
          <button
            onClick={() => openSettingsView('video-effects')}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition ${settingsView === 'video-effects' ? 'bg-brand-500 text-white' : 'bg-surface-700 text-surface-300 hover:bg-surface-600'}`}
          >
            Effects
          </button>
        </div>

        {settingsView === 'devices' && (
          <>
            {/* Devices Section - Collapsible */}
            <div className="rounded-xl border border-surface-700 bg-surface-750/50 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('devices')}
                className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-surface-700/50 transition"
              >
                <h3 className="text-sm font-medium text-surface-200 flex items-center gap-2">
                  <Video size={16} />
                  Devices
                </h3>
                {expandedSections.devices ? <ChevronDown size={16} className="text-surface-400" /> : <ChevronRight size={16} className="text-surface-400" />}
              </button>
              
              {expandedSections.devices && (
                <div className="px-4 pb-4 space-y-4">
                  <div>
                    <label className="text-xs text-surface-400 mb-2 block">Camera</label>
                    <select 
                      value={selectedCamera}
                      onChange={e => { void handleCameraChange(e.target.value); }}
                      className="w-full bg-surface-700 text-surface-100 rounded-lg px-3 py-2.5 text-sm border border-surface-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 focus:outline-none"
                    >
                      <option value="">Default Camera</option>
                      {cameras.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 8)}`}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-surface-400 mb-2 block">Microphone</label>
                    <select 
                      value={selectedMic}
                      onChange={e => { void handleMicChange(e.target.value); }}
                      className="w-full bg-surface-700 text-surface-100 rounded-lg px-3 py-2.5 text-sm border border-surface-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 focus:outline-none"
                    >
                      <option value="">Default Microphone</option>
                      {mics.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 8)}`}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-surface-400 mb-2 block flex items-center gap-2">
                      <Volume2 size={12} />
                      Speaker Volume: {speakerVolume}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={speakerVolume}
                      onChange={e => handleSpeakerVolumeChange(parseInt(e.target.value))}
                      className="w-full accent-brand-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Meeting Settings Section - Moderators ONLY */}
            {isModerator && (
              <div className="rounded-xl border border-warning-700/50 bg-warning-900/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('meetingSettings')}
                  className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-surface-700/50 transition"
                >
                  <h3 className="text-sm font-medium text-surface-200 flex items-center gap-2">
                    <Shield size={16} className="text-warning-400" />
                    Meeting Settings
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning-500/20 text-warning-400">Host</span>
                  </h3>
                  {expandedSections.meetingSettings ? <ChevronDown size={16} className="text-surface-400" /> : <ChevronRight size={16} className="text-surface-400" />}
                </button>
                
                {expandedSections.meetingSettings && (
                  <div className="px-4 pb-4 space-y-4">
                    {meetingRoomConfig.features.qualityModeSelector && (
                      <div>
                        <label className="text-xs text-surface-400 mb-2 block flex items-center gap-2">
                          Quality Mode
                          <span className="text-[10px] px-1 py-0.5 rounded bg-surface-700 text-surface-400">Host default</span>
                        </label>
                        <select
                          value={autoFallbackActive ? selectedQualityMode : qualityMode}
                          onChange={(e) => setQualityMode(e.target.value as QualityModeName)}
                          className="w-full bg-surface-700 text-surface-100 rounded-lg px-3 py-2.5 text-sm border border-surface-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 focus:outline-none"
                        >
                          {meetingRoomConfig.qualityModes.availableModes.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode === 'dataSaver' ? 'Data Saver' : mode === 'highQuality' ? 'High Quality' : mode === 'audioOnly' ? 'Audio Only' : 'Auto'}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-surface-500 mt-1">Sets the host's preferred default, not an active force-sync</p>
                      </div>
                    )}

                    {meetingRoomConfig.features.screenshareModeSelector && (
                      <div>
                        <label className="text-xs text-surface-400 mb-2 block flex items-center gap-2">
                          Screenshare Mode
                          <span className="text-[10px] px-1 py-0.5 rounded bg-surface-700 text-surface-400">Host default</span>
                        </label>
                        <select
                          value={screenShareMode}
                          onChange={(e) => setScreenShareMode(e.target.value as ScreenShareModeName)}
                          className="w-full bg-surface-700 text-surface-100 rounded-lg px-3 py-2.5 text-sm border border-surface-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 focus:outline-none"
                        >
                          <option value="documents">Documents / Slides</option>
                          <option value="motion">Motion / Video</option>
                        </select>
                        <p className="text-xs text-surface-500 mt-1">Stores the host's preferred default for future screen shares</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {settingsView === 'call-health' && (
          <>
            <div className="rounded-xl border border-surface-700 bg-surface-750/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-surface-200">
                <Activity size={16} className={callHealthTone} />
                <span className="text-sm font-medium">Connection Status</span>
              </div>
              <div className="space-y-2 text-xs text-surface-400">
                <div className="flex items-center justify-between">
                  <span>Room state</span>
                  <span className={callHealthTone}>{connectionState}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Connection quality</span>
                  <span>{connectionQualityLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Packet loss</span>
                  <span>{packetLossPercent == null ? 'n/a' : `${packetLossPercent.toFixed(1)}%`}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>RTT</span>
                  <span>{rttMs == null ? 'n/a' : `${Math.round(rttMs)} ms`}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Jitter</span>
                  <span>{jitterMs == null ? 'n/a' : `${Math.round(jitterMs)} ms`}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Avail bitrate</span>
                  <span>{availableBitrateKbps == null ? 'n/a' : `${Math.round(availableBitrateKbps)} kbps`}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Battery</span>
                  <span>
                    {batteryLevelPercent == null
                      ? 'n/a'
                      : `${batteryLevelPercent}%${batteryCharging ? ' charging' : ''}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Quality mode</span>
                  <span>{qualityMode}</span>
                </div>
                {autoFallbackActive && (
                  <div className="flex items-center justify-between">
                    <span>Auto fallback</span>
                    <span>{qualityOverrideReason} ({selectedQualityMode} to {qualityMode})</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Microphone</span>
                  <span>{localParticipant?.isMicrophoneEnabled ? 'On' : 'Off'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Camera</span>
                  <span>{localParticipant?.isCameraEnabled ? 'On' : 'Off'}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-surface-700 bg-surface-750/50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-surface-200">
                <Users size={16} />
                <span className="text-sm font-medium">Session</span>
              </div>
              <p className="text-xs text-surface-400">Room: {room.name}</p>
              <p className="text-xs text-surface-400">You: {localParticipant?.identity}</p>
              <p className="text-xs text-surface-400">Remote participants: {remoteParticipantCount}</p>
            </div>

            <div className="rounded-xl border border-surface-700 bg-surface-750/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-surface-200">
                  <Activity size={16} />
                  <span className="text-sm font-medium">Thresholds</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadDiagnostics}
                    className="text-[11px] text-surface-400 hover:text-surface-200"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => { void uploadDiagnostics(); }}
                    disabled={uploadingDiagnostics}
                    className="text-[11px] text-surface-400 hover:text-surface-200 disabled:opacity-50"
                  >
                    {uploadingDiagnostics ? 'Uploading...' : 'Upload'}
                  </button>
                  <button
                    onClick={clearDiagnosticsLog}
                    className="text-[11px] text-surface-400 hover:text-surface-200"
                  >
                    Clear log
                  </button>
                </div>
              </div>
              <div className="space-y-1 text-xs text-surface-400">
                <div className="flex items-center justify-between">
                  <span>Loss warn / poor</span>
                  <span>{meetingRoomConfig.network.packetLossWarningPercent}% / {meetingRoomConfig.network.packetLossPoorPercent}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>RTT warn / poor</span>
                  <span>{meetingRoomConfig.network.rttWarningMs} / {meetingRoomConfig.network.rttPoorMs} ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Jitter warn / poor</span>
                  <span>{meetingRoomConfig.network.jitterWarningMs} / {meetingRoomConfig.network.jitterPoorMs} ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Bitrate warn / recover</span>
                  <span>
                    {Math.round(meetingRoomConfig.network.availableBitrateWarningBps / 1000)} / {Math.round(meetingRoomConfig.network.availableBitrateGoodBps / 1000)} kbps
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Low battery saver</span>
                  <span>{meetingRoomConfig.mobile.reduceQualityWhenBatteryBelowPercent}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Recovery window</span>
                  <span>{Math.round(meetingRoomConfig.performance.qualityRestoreDurationMs / 1000)} sec</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-surface-700 bg-surface-750/50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-surface-200">
                <Activity size={16} />
                <span className="text-sm font-medium">Diagnostics Trail</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {diagnosticsLog.length === 0 ? (
                  <p className="text-xs text-surface-500">No fallback or recovery events recorded yet.</p>
                ) : (
                  diagnosticsLog.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-surface-700 px-3 py-2">
                      <div className="flex items-center justify-between text-[11px] text-surface-500">
                        <span>{entry.type}</span>
                        <span>{new Date(entry.at).toLocaleTimeString()}</span>
                      </div>
                      <p className="mt-1 text-xs text-surface-300">{entry.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {settingsView === 'video-effects' && (
          <>
            {/* Aspect Ratio - Moderators ONLY */}
            {isModerator && (
              <div className="rounded-xl border border-warning-700/50 bg-warning-900/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-surface-200">
                  <Grid3X3 size={16} className="text-warning-400" />
                  <span className="text-sm font-medium">Aspect Ratio</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning-500/20 text-warning-400">Host</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700 text-surface-400">Meeting-wide</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { ratio: '16:9' as const, label: '16:9', desc: 'Widescreen', icon: Maximize2 },
                    { ratio: '9:16' as const, label: '9:16', icon: Maximize2 },
                    { ratio: '1:1' as const, label: '1:1', icon: SquareIcon },
                    { ratio: '4:3' as const, label: '4:3', icon: Crop },
                  ]).map(({ ratio, label, icon: Icon }) => (
                    <button
                      key={ratio}
                      onClick={() => { void handleAspectRatioChange(ratio); }}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                        gridAspectRatio === ratio
                          ? 'bg-brand-500 text-white'
                          : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                      }`}
                    >
                      <Icon size={14} className={ratio === '9:16' ? 'rotate-90' : ''} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-surface-500">Sets tile size for all participants. Changes are saved to the meeting.</p>
              </div>
            )}
            
            {/* Video Fit Mode - Personal preference (ALL users) */}
            <div className="rounded-xl border border-surface-700 bg-surface-750/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-surface-200">
                <Crop size={16} />
                <span className="text-sm font-medium">Video Fit</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400">Personal</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleVideoFitModeChange('cover')}
                  className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    videoFitMode === 'cover'
                      ? 'bg-brand-500 text-white'
                      : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                  }`}
                >
                  <Crop size={16} />
                  <span>Crop (Fill)</span>
                </button>
                <button
                  onClick={() => handleVideoFitModeChange('contain')}
                  className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    videoFitMode === 'contain'
                      ? 'bg-brand-500 text-white'
                      : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                  }`}
                >
                  <Maximize2 size={16} />
                  <span>Fit (Letterbox)</span>
                </button>
              </div>
              <p className="text-xs text-surface-500">
                {videoFitMode === 'cover' 
                  ? 'Crops edges to fill frame (no black bars)' 
                  : 'Shows full video with black bars if needed'}
              </p>
            </div>

            {/* Mirror My Tile - Personal preference */}
            <button
              onClick={toggleMirrorLocalVideo}
              className="w-full rounded-xl border border-surface-700 bg-surface-750/50 px-4 py-3 text-left transition hover:bg-surface-700"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-surface-200">
                  <FlipHorizontal size={16} />
                  <span className="text-sm font-medium">Mirror My Tile</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400">Personal</span>
                </div>
                <span className={`text-xs ${mirrorLocalVideo ? 'text-success-400' : 'text-surface-400'}`}>
                  {mirrorLocalVideo ? 'On' : 'Off'}
                </span>
              </div>
              <p className="mt-1 text-xs text-surface-400">Flip your video horizontally (mirror effect)</p>
            </button>

            {/* Background Effects */}
            <div className="rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-surface-700 dark:text-surface-200">
                  <Eye size={16} />
                  <span className="text-sm font-medium">Background Effect</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400">Personal</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={backgroundBlurEnabled}
                  onClick={toggleBackgroundBlur}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    backgroundBlurEnabled ? 'bg-brand-500' : 'bg-surface-300 dark:bg-surface-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      backgroundBlurEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="mt-1 text-xs text-surface-400">Apply effects to your camera background</p>

              {backgroundBlurEnabled && (
                <div className="mt-3 space-y-3">
                  {/* Mode selector */}
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-surface-400">
                      <span>Mode</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {([
                        { mode: 'blur' as const, label: 'Blur' },
                        { mode: 'color' as const, label: 'Color' },
                        { mode: 'image' as const, label: 'Image' },
                        { mode: 'none' as const, label: 'None' },
                      ]).map(({ mode, label }) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setBackgroundMode(mode)}
                          className={`rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                            backgroundMode === mode
                              ? 'bg-brand-500 text-white'
                              : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Blur intensity slider (shown for blur mode) */}
                  {backgroundMode === 'blur' && (
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-surface-400">
                        <span>Blur intensity</span>
                        <span>{backgroundBlurIntensity}px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={40}
                        step={1}
                        value={backgroundBlurIntensity}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setBackgroundBlurIntensity(v);
                          setBackgroundBlurLevel(v);
                        }}
                        className="w-full accent-brand-500"
                      />
                    </div>
                  )}

                  {/* Color picker (shown for color mode) */}
                  {backgroundMode === 'color' && (
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-surface-400">
                        <span>Background color</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={backgroundBgColor}
                          onChange={(e) => setBackgroundBgColor(e.target.value)}
                          className="h-8 w-12 rounded border border-surface-600 bg-transparent"
                        />
                        <span className="text-xs text-surface-400 font-mono">{backgroundBgColor}</span>
                      </div>
                    </div>
                  )}

                  {/* Image URL (shown for image mode) */}
                  {backgroundMode === 'image' && (
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-surface-400">
                        <span>Background image URL</span>
                      </div>
                      <input
                        type="url"
                        value={backgroundImagePath ?? ''}
                        onChange={(e) => setBackgroundImagePath(e.target.value || null)}
                        placeholder="https://example.com/background.jpg"
                        className="w-full rounded-lg bg-surface-700 border border-surface-600 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:border-brand-500 focus:outline-none"
                      />
                      <p className="mt-1 text-xs text-surface-500">Enter an image URL to use as your virtual background</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
