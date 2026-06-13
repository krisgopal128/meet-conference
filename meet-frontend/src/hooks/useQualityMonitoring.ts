/**
 * useQualityMonitoring - Handles connection quality monitoring and automatic quality overrides
 * 
 * Extracted from ConferenceRoom to reduce component complexity.
 * Monitors connection quality and triggers quality degradation/recovery.
 */

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

  // Connection quality monitoring
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
          // Use dataSaver instead of audioOnly — audioOnly kills camera entirely
          // which users can't recover from. dataSaver degrades video without disabling it.
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
    return () => {
      room.off(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
      room.localParticipant.off(ParticipantEvent.LocalTrackCpuConstrained, handleCpuConstraint);
      clearRecoveryTimer();
    };
  }, [room, localParticipant, selectedQualityMode, scheduleRecovery]);

  return { scheduleRecovery, qualityOverrideReasonRef };
}
