/**
 * useDiagnosticsReporting — periodically samples WebRTC stats and POSTs
 * a snapshot to the backend for admin bandwidth/quality charts.
 *
 * Interval is configurable (default 120s). Only active for authenticated users.
 * All errors are silently swallowed — diagnostics must never disrupt the call.
 */

import { useEffect, useRef } from 'react';
import type { Room } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';
import { meetingsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import logger from '../utils/logger';

const DEFAULT_INTERVAL_MS = 120_000;
const FIRST_REPORT_DELAY_MS = 30_000;

interface UseDiagnosticsReportingProps {
  roomName?: string;
  intervalMs?: number;
}

export function useDiagnosticsReporting({ roomName, intervalMs }: UseDiagnosticsReportingProps) {
  const room = useRoomContext() as Room | null;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  // Track previous cumulative counters for delta calculations
  const prevBytesSentRef = useRef(0);
  const prevBytesReceivedRef = useRef(0);
  const prevPacketsLostRef = useRef(0);
  const prevPacketsReceivedRef = useRef(0);
  const prevFramesDroppedRef = useRef(0);
  const hasBaselineRef = useRef(false);

  useEffect(() => {
    if (!room || !roomName) return;
    if (!intervalMs || intervalMs <= 0) return; // "Off" — no reporting

    const collectAndReport = async () => {
      if (!isAuthenticatedRef.current) return;

      try {
        let totalBytesSent = 0;
        let totalBytesReceived = 0;
        let totalPacketsLost = 0;
        let totalPacketsReceived = 0;
        let totalFramesDropped = 0;
        const rtts: number[] = [];
        const jitters: number[] = [];
        const bitrates: number[] = [];
        let videoCodec: string | null = null;

        const collectFromStats = (stats: RTCStatsReport | undefined) => {
          if (!stats) return;
          stats.forEach((stat) => {
            const s = stat as Record<string, unknown>;

            if (stat.type === 'candidate-pair' && s.state === 'succeeded') {
              if (typeof s.currentRoundTripTime === 'number') {
                rtts.push(s.currentRoundTripTime * 1000);
              }
              if (typeof s.availableOutgoingBitrate === 'number') {
                bitrates.push(s.availableOutgoingBitrate / 1000);
              }
            }

            if (stat.type === 'inbound-rtp') {
              if (typeof s.bytesReceived === 'number') {
                totalBytesReceived += s.bytesReceived;
              }
              if (typeof s.packetsLost === 'number') {
                totalPacketsLost += s.packetsLost;
              }
              if (typeof s.packetsReceived === 'number') {
                totalPacketsReceived += s.packetsReceived;
              }
              if (typeof s.jitter === 'number') {
                jitters.push(s.jitter * 1000);
              }
              if (s.kind === 'video') {
                if (typeof s.framesDropped === 'number') {
                  totalFramesDropped += s.framesDropped;
                }
              }
            }

            if (stat.type === 'outbound-rtp') {
              if (typeof s.bytesSent === 'number') {
                totalBytesSent += s.bytesSent;
              }
              if (s.kind === 'video' && !videoCodec && typeof s.codecId === 'string') {
                const codecStat = stats.get(s.codecId);
                if (codecStat && typeof (codecStat as Record<string, unknown>).mimeType === 'string') {
                  videoCodec = (codecStat as Record<string, unknown>).mimeType as string;
                }
              }
            }
          });
        };

        // Gather stats from all tracks
        const localParticipant = room.localParticipant;
        for (const [, pub] of localParticipant.trackPublications) {
          const report = await pub.track?.getRTCStatsReport?.();
          collectFromStats(report);
        }

        for (const participant of room.remoteParticipants.values()) {
          for (const [, pub] of participant.trackPublications) {
            const report = await pub.track?.getRTCStatsReport?.();
            collectFromStats(report);
          }
        }

        // First sample establishes the baseline — deltas are meaningless
        if (!hasBaselineRef.current) {
          prevBytesSentRef.current = totalBytesSent;
          prevBytesReceivedRef.current = totalBytesReceived;
          prevPacketsLostRef.current = totalPacketsLost;
          prevPacketsReceivedRef.current = totalPacketsReceived;
          prevFramesDroppedRef.current = totalFramesDropped;
          hasBaselineRef.current = true;
          return;
        }

        // Compute deltas — WebRTC counters are cumulative since track start,
        // so we must diff against the previous sample to get per-interval values.
        // Storing deltas (not cumulative) makes SUM() in the dashboard correct.
        const deltaBytesSent = Math.max(0, totalBytesSent - prevBytesSentRef.current);
        const deltaBytesReceived = Math.max(0, totalBytesReceived - prevBytesReceivedRef.current);
        const deltaLost = Math.max(0, totalPacketsLost - prevPacketsLostRef.current);
        const deltaReceived = Math.max(0, totalPacketsReceived - prevPacketsReceivedRef.current);
        const deltaFramesDropped = Math.max(0, totalFramesDropped - prevFramesDroppedRef.current);

        // Update baselines
        prevBytesSentRef.current = totalBytesSent;
        prevBytesReceivedRef.current = totalBytesReceived;
        prevPacketsLostRef.current = totalPacketsLost;
        prevPacketsReceivedRef.current = totalPacketsReceived;
        prevFramesDroppedRef.current = totalFramesDropped;

        const packetLossPct = deltaLost + deltaReceived > 0
          ? (deltaLost / (deltaLost + deltaReceived)) * 100
          : 0;

        const rttMs = rtts.length > 0 ? Math.max(...rtts) : null;
        const jitterMs = jitters.length > 0 ? Math.max(...jitters) : null;
        const availableBitrateKbps = bitrates.length > 0 ? Math.min(...bitrates) : null;

        await meetingsApi.uploadDiagnosticsSnapshot({
          roomName,
          bytesSent: deltaBytesSent,
          bytesReceived: deltaBytesReceived,
          packetsLost: deltaLost,
          rttMs: rttMs != null ? Math.round(rttMs) : null,
          codec: videoCodec,
          packetLossPct: Math.round(packetLossPct * 100) / 100,
          jitterMs: jitterMs != null ? Math.round(jitterMs) : null,
          availableBitrateKbps: availableBitrateKbps != null ? Math.round(availableBitrateKbps) : null,
          framesDropped: deltaFramesDropped,
        });
      } catch (err) {
        logger.warn('[useDiagnosticsReporting] Failed to report snapshot:', err);
      }
    };

    const effectiveInterval = intervalMs ?? DEFAULT_INTERVAL_MS;

    const firstReport = window.setTimeout(collectAndReport, FIRST_REPORT_DELAY_MS);
    const interval = window.setInterval(collectAndReport, effectiveInterval);

    return () => {
      window.clearTimeout(firstReport);
      window.clearInterval(interval);
    };
  }, [room, roomName, intervalMs]);
}
