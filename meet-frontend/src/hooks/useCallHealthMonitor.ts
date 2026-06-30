/**
 * useCallHealthMonitor - Polls WebRTC stats for the call-health diagnostics panel
 *
 * Extracted from ConferenceRoom to reduce component complexity.
 * Activates only when the settings panel is open on the 'call-health' view,
 * sampling packet loss, RTT, jitter, and available bitrate every 2 seconds.
 * Computes warning/critical thresholds and applies quality overrides.
 */

import { useEffect, useRef } from 'react';
import type { Room, Participant } from 'livekit-client';
import { meetingRoomConfig, type QualityModeName } from '../config/meetingRoomConfig';
import type { QualityOverrideReason } from '../store/roomStore';
import toast from 'react-hot-toast';

interface CallMetrics {
  packetLossPercent: number | null;
  rttMs: number | null;
  jitterMs: number | null;
  availableBitrateKbps: number | null;
}

interface DiagnosticsEvent {
  type: 'network' | 'cpu' | 'battery' | 'recovery' | 'manual';
  message: string;
}

interface UseCallHealthMonitorProps {
  room: Room;
  localParticipant: Participant;
  isActive: boolean;
  selectedQualityMode: QualityModeName;
  setCallMetrics: (metrics: Partial<CallMetrics>) => void;
  setQualityOverride: (mode: QualityModeName | null, reason?: QualityOverrideReason) => void;
  addDiagnosticsEvent: (event: DiagnosticsEvent) => void;
  qualityOverrideReasonRef: React.MutableRefObject<QualityOverrideReason>;
  scheduleRecovery: (reason: Exclude<QualityOverrideReason, null>) => void;
}

export function useCallHealthMonitor({
  room,
  localParticipant: _localParticipant,
  isActive,
  selectedQualityMode,
  setCallMetrics,
  setQualityOverride,
  addDiagnosticsEvent,
  qualityOverrideReasonRef,
  scheduleRecovery,
}: UseCallHealthMonitorProps) {
  const prevLostRef = useRef(0);
  const prevReceivedRef = useRef(0);
  const hasBaselineRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    hasBaselineRef.current = false;
    let cancelled = false;

    const sampleStats = async () => {
      const reports = await Promise.all([
        ...Array.from(room.remoteParticipants.values()).flatMap((participant) =>
          Array.from(participant.trackPublications.values()).map((publication) =>
            publication.track?.getRTCStatsReport?.(),
          ),
        ),
        ...Array.from(room.localParticipant.trackPublications.values()).map((publication) =>
          publication.track?.getRTCStatsReport?.(),
        ),
      ]);

      if (cancelled) {
        return;
      }

      let totalLost = 0;
      let totalReceived = 0;
      const rtts: number[] = [];
      const jitters: number[] = [];
      const bitrates: number[] = [];

      reports.forEach((report) => {
        report?.forEach((stat: RTCStats) => {
          const candidatePair = stat as RTCStats & { currentRoundTripTime?: number; availableOutgoingBitrate?: number; state?: string };
          const inbound = stat as RTCStats & { packetsLost?: number; packetsReceived?: number; jitter?: number; kind?: string };
          const remoteInbound = stat as RTCStats & { roundTripTime?: number; jitter?: number };

          if (stat.type === 'candidate-pair' && candidatePair.state === 'succeeded') {
            if (typeof candidatePair.currentRoundTripTime === 'number') {
              rtts.push(candidatePair.currentRoundTripTime * 1000);
            }
            if (typeof candidatePair.availableOutgoingBitrate === 'number') {
              bitrates.push(candidatePair.availableOutgoingBitrate / 1000);
            }
          }

          if (stat.type === 'inbound-rtp') {
            if (typeof inbound.packetsLost === 'number') {
              totalLost += inbound.packetsLost;
            }
            if (typeof inbound.packetsReceived === 'number') {
              totalReceived += inbound.packetsReceived;
            }
            if (typeof inbound.jitter === 'number') {
              jitters.push(inbound.jitter * 1000);
            }
          }

          if (stat.type === 'remote-inbound-rtp') {
            if (typeof remoteInbound.jitter === 'number') {
              jitters.push(remoteInbound.jitter * 1000);
            }
            if (typeof remoteInbound.roundTripTime === 'number') {
              rtts.push(remoteInbound.roundTripTime * 1000);
            }
          }
        });
      });

      // First sample establishes baseline — deltas are meaningless on first tick
      if (!hasBaselineRef.current) {
        prevLostRef.current = totalLost;
        prevReceivedRef.current = totalReceived;
        hasBaselineRef.current = true;
        setCallMetrics({ packetLossPercent: null, rttMs: null, jitterMs: null, availableBitrateKbps: null });
        return;
      }

      const deltaLost = Math.max(0, totalLost - prevLostRef.current);
      const deltaReceived = Math.max(0, totalReceived - prevReceivedRef.current);
      prevLostRef.current = totalLost;
      prevReceivedRef.current = totalReceived;

      const packetLossPercent = deltaLost + deltaReceived > 0
        ? (deltaLost / (deltaLost + deltaReceived)) * 100
        : null;
      const rttMs = rtts.length ? Math.max(...rtts) : null;
      const jitterMs = jitters.length ? Math.max(...jitters) : null;
      const availableBitrateKbps = bitrates.length ? Math.min(...bitrates) : null;

      setCallMetrics({
        packetLossPercent,
        rttMs,
        jitterMs,
        availableBitrateKbps,
      });

      const warning =
        (packetLossPercent != null && packetLossPercent >= meetingRoomConfig.network.packetLossWarningPercent) ||
        (rttMs != null && rttMs >= meetingRoomConfig.network.rttWarningMs) ||
        (jitterMs != null && jitterMs >= meetingRoomConfig.network.jitterWarningMs) ||
        (availableBitrateKbps != null && availableBitrateKbps * 1000 <= meetingRoomConfig.network.availableBitrateWarningBps);

      const critical =
        (packetLossPercent != null && packetLossPercent >= meetingRoomConfig.network.packetLossPoorPercent) ||
        (rttMs != null && rttMs >= meetingRoomConfig.network.rttPoorMs) ||
        (jitterMs != null && jitterMs >= meetingRoomConfig.network.jitterPoorMs) ||
        (availableBitrateKbps != null && availableBitrateKbps * 1000 <= meetingRoomConfig.network.availableBitrateWarningBps / 2);
      const bitrateRecovered =
        availableBitrateKbps == null ||
        availableBitrateKbps * 1000 >= meetingRoomConfig.network.availableBitrateGoodBps;

      const shouldAutoAdjust = selectedQualityMode === 'auto';

      const currentOverrideReason = qualityOverrideReasonRef.current;

      if (critical) {
        if (shouldAutoAdjust) {
          if (currentOverrideReason !== 'network') {
            addDiagnosticsEvent({
              type: 'network',
              message: `Critical transport stats: loss=${packetLossPercent?.toFixed(1) ?? 'n/a'}% rtt=${rttMs ? Math.round(rttMs) : 'n/a'}ms jitter=${jitterMs ? Math.round(jitterMs) : 'n/a'}ms bitrate=${availableBitrateKbps ? Math.round(availableBitrateKbps) : 'n/a'}kbps; forcing audioOnly`,
            });
            if (meetingRoomConfig.features.networkRecoveryToasts) {
              toast(meetingRoomConfig.feedback.networkDegradedMessage, { id: 'network-quality' });
            }
          }
          setQualityOverride('audioOnly', 'network');
        }
      } else if (warning) {
        if (shouldAutoAdjust) {
          if (currentOverrideReason !== 'network') {
            addDiagnosticsEvent({
              type: 'network',
              message: `Warning transport stats: loss=${packetLossPercent?.toFixed(1) ?? 'n/a'}% rtt=${rttMs ? Math.round(rttMs) : 'n/a'}ms jitter=${jitterMs ? Math.round(jitterMs) : 'n/a'}ms bitrate=${availableBitrateKbps ? Math.round(availableBitrateKbps) : 'n/a'}kbps; forcing dataSaver`,
            });
            if (meetingRoomConfig.features.networkRecoveryToasts) {
              toast(meetingRoomConfig.feedback.networkDegradedMessage, { id: 'network-quality' });
            }
          }
          setQualityOverride('dataSaver', 'network');
        }
      } else if (currentOverrideReason === 'network' && bitrateRecovered) {
        scheduleRecovery('network');
      }
    };

    void sampleStats();
    const interval = window.setInterval(() => {
      void sampleStats();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [room, isActive, selectedQualityMode, scheduleRecovery, setCallMetrics, setQualityOverride, addDiagnosticsEvent, qualityOverrideReasonRef]);
}
