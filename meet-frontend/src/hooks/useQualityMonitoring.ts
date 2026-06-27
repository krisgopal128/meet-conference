import { useEffect, useRef, useCallback } from 'react';
import { RoomEvent, ParticipantEvent, type Room, type Participant } from 'livekit-client';
import { useUIActions, useQualityOverrideReason, type QualityOverrideReason } from '../store/roomStore';
import { meetingRoomConfig } from '../config/meetingRoomConfig';
import type { QualityModeName } from '../config/meetingRoomConfig';
import toast from 'react-hot-toast';

interface UseQualityMonitoringProps {
  room: Room;
  localParticipant: Participant;
  selectedQualityMode: QualityModeName;
}

export function useQualityMonitoring({ room, localParticipant, selectedQualityMode }: UseQualityMonitoringProps) {
  const qualityOverrideReason = useQualityOverrideReason();
  const qualityOverrideReasonRef = useRef(qualityOverrideReason);
  
  const { setQualityOverride, setConnectionQualityLabel, addDiagnosticsEvent } = useUIActions();
  const setQualityOverrideRef = useRef(setQualityOverride);
  const addDiagnosticsEventRef = useRef(addDiagnosticsEvent);
  const setConnectionQualityLabelRef = useRef(setConnectionQualityLabel);
  setQualityOverrideRef.current = setQualityOverride;
  addDiagnosticsEventRef.current = addDiagnosticsEvent;
  setConnectionQualityLabelRef.current = setConnectionQualityLabel;
  
  const recoveryTimerRef = useRef<number | null>(null);
  const decodeTimerRef = useRef<number | null>(null);
  const decodeMountedRef = useRef(false);
  const consecutiveBadDecodeRef = useRef(0);
  const prevFramesDroppedRef = useRef(0);
  const prevFramesDecodedRef = useRef(0);
  const prevPliCountRef = useRef(0);

  useEffect(() => {
    qualityOverrideReasonRef.current = qualityOverrideReason;
  }, [qualityOverrideReason]);

  const clearRecoveryTimer = () => {
    if (recoveryTimerRef.current) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  };

  const scheduleRecovery = useCallback((reason: Exclude<QualityOverrideReason, null>) => {
    const toastId = `${reason}-quality`;
    const recoveryLabel = reason === 'battery' ? 'battery' : reason.toUpperCase();

    clearRecoveryTimer();
    recoveryTimerRef.current = window.setTimeout(() => {
      setQualityOverrideRef.current(null);
      addDiagnosticsEventRef.current({
        type: 'recovery',
        message: `Recovered to selected mode after ${recoveryLabel} stabilization`,
      });
      if (meetingRoomConfig.features.networkRecoveryToasts) {
        toast.success(meetingRoomConfig.feedback.networkRecoveredMessage, { id: toastId });
      }
      recoveryTimerRef.current = null;
    }, meetingRoomConfig.performance.qualityRestoreDurationMs);
  }, []);

  useEffect(() => {
    if (!localParticipant) return;

    let lastQuality = String(localParticipant.connectionQuality ?? '').toLowerCase();

    const handleConnectionQualityChanged = (_quality?: unknown, participant?: Participant) => {
      if (participant && participant !== localParticipant) return;
      const nextQuality = String(localParticipant.connectionQuality ?? '').toLowerCase();
      setConnectionQualityLabelRef.current(nextQuality || 'unknown');
      if (nextQuality === lastQuality) return;

      if (recoveryTimerRef.current && (nextQuality === 'poor' || nextQuality === 'lost')) {
        window.clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }

      const shouldAutoAdjust = selectedQualityMode === 'auto';

      if (nextQuality === 'poor') {
        if (shouldAutoAdjust) {
          setQualityOverrideRef.current('dataSaver', 'network');
          addDiagnosticsEventRef.current({
            type: 'network',
            message: `Connection quality dropped to poor; forcing dataSaver`,
          });
          if (meetingRoomConfig.features.networkRecoveryToasts) {
            toast(meetingRoomConfig.feedback.networkDegradedMessage, { id: 'network-quality' });
          }
        }
      } else if (nextQuality === 'lost') {
        if (shouldAutoAdjust) {
          setQualityOverrideRef.current('dataSaver', 'network');
          addDiagnosticsEventRef.current({
            type: 'network',
            message: `Connection quality dropped to lost; forcing dataSaver`,
          });
          if (meetingRoomConfig.features.networkRecoveryToasts) {
            toast(meetingRoomConfig.feedback.networkDegradedMessage, { id: 'network-quality' });
          }
        }
      } else if (lastQuality && (nextQuality === 'good' || nextQuality === 'excellent')) {
        if (qualityOverrideReasonRef.current) {
          scheduleRecovery('network');
        }
      }

      lastQuality = nextQuality;
    };

    const handleCpuConstraint = () => {
      const shouldAutoAdjust = selectedQualityMode === 'auto';
      if (shouldAutoAdjust) {
        setQualityOverrideRef.current('dataSaver', 'cpu');
        addDiagnosticsEventRef.current({
          type: 'cpu',
          message: 'LiveKit reported local track CPU constraint; forcing dataSaver',
        });
        if (meetingRoomConfig.features.networkRecoveryToasts) {
          toast(meetingRoomConfig.feedback.cpuFallbackMessage, { id: 'cpu-quality' });
        }
        scheduleRecovery('cpu');
      }
    };

    handleConnectionQualityChanged();
    room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
    room.localParticipant.on(ParticipantEvent.LocalTrackCpuConstrained, handleCpuConstraint);

    decodeMountedRef.current = true;
    const checkDecodeHealth = async () => {
      const participants = Array.from(room.remoteParticipants.values());
      let totalFramesDropped = 0;
      let totalFramesDecoded = 0;
      let totalPliCount = 0;

      for (const participant of participants) {
        if (!decodeMountedRef.current) return;
        for (const [, publication] of participant.trackPublications) {
          if (!decodeMountedRef.current) return;
          const track = publication.track;
          if (!track) continue;
          const stats = await track.getRTCStatsReport?.();
          if (!decodeMountedRef.current) return;
          if (!stats) continue;
          stats.forEach((stat) => {
            const s = stat as Record<string, unknown>;
            if (stat.type === 'inbound-rtp' && s.kind === 'video') {
              totalFramesDropped += (s.framesDropped as number) || 0;
              totalFramesDecoded += (s.framesDecoded as number) || 0;
              totalPliCount += (s.pliCount as number) || 0;
            }
          });
        }
      }

      const deltaDropped = Math.max(0, totalFramesDropped - prevFramesDroppedRef.current);
      const deltaDecoded = Math.max(0, totalFramesDecoded - prevFramesDecodedRef.current);
      const deltaPli = Math.max(0, totalPliCount - prevPliCountRef.current);
      prevFramesDroppedRef.current = totalFramesDropped;
      prevFramesDecodedRef.current = totalFramesDecoded;
      prevPliCountRef.current = totalPliCount;

      // ponytail: symmetric thresholds to match calculateDecodeScore in useNetworkQuality
      const dropRate = deltaDropped + deltaDecoded > 0
        ? deltaDropped / (deltaDropped + deltaDecoded)
        : 0;
      const dropScore = Math.max(0, 60 - (dropRate * 1200));
      const pliScore = Math.max(0, 40 - (deltaPli * 13));
      const decodeScore = Math.round(dropScore + pliScore);

      if (decodeScore < 40) {
        consecutiveBadDecodeRef.current++;
        if (consecutiveBadDecodeRef.current >= 2) {
          const shouldAutoAdjust = selectedQualityMode === 'auto';
          if (shouldAutoAdjust) {
            setQualityOverrideRef.current('dataSaver', 'decode');
            addDiagnosticsEventRef.current({
              type: 'decode',
              message: `Decode health poor (score=${decodeScore}, drops=${(dropRate * 100).toFixed(1)}%, pli=${deltaPli}); forcing dataSaver`,
            });
          }
        }
      } else if (decodeScore >= 60) {
        consecutiveBadDecodeRef.current = 0;
        if (qualityOverrideReasonRef.current === 'decode') {
          scheduleRecovery('decode');
        }
      }
    };

    checkDecodeHealth();
    decodeTimerRef.current = window.setInterval(checkDecodeHealth, 5000);

    return () => {
      decodeMountedRef.current = false;
      room.off(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
      room.localParticipant.off(ParticipantEvent.LocalTrackCpuConstrained, handleCpuConstraint);
      clearRecoveryTimer();
      if (decodeTimerRef.current) {
        window.clearInterval(decodeTimerRef.current);
      }
    };
  }, [room, localParticipant, selectedQualityMode, scheduleRecovery]);

  return { scheduleRecovery, qualityOverrideReasonRef };
}
