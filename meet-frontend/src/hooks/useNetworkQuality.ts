import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRoomContext } from '@livekit/components-react';
import logger from '../utils/logger';

export type NetworkQualityLevel = 'excellent' | 'good' | 'fair' | 'poor';

export type NetworkQualityScore = {
  score: number;
  level: NetworkQualityLevel;
  packetLoss: number;
  rtt: number;
  jitter: number;
  availableBitrate: number;
  decodeScore: number;
  framesDroppedRate: number;
  pliCountDelta: number;
};

interface NetworkQualityConfig {
  checkIntervalMs: number;
  scoreThresholds: {
    excellent: number;
    good: number;
    fair: number;
  };
  debounceMs: number;
}

const DEFAULT_CONFIG: NetworkQualityConfig = {
  checkIntervalMs: 5000,
  scoreThresholds: {
    excellent: 80,
    good: 60,
    fair: 40,
  },
  debounceMs: 5000,
};

export function useNetworkQuality(config: Partial<NetworkQualityConfig> = {}) {
  const configKey = JSON.stringify(config);
  const finalConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [configKey]);
  const room = useRoomContext();
  
  const [quality, setQuality] = useState<NetworkQualityScore>({
    score: 100,
    level: 'excellent',
    packetLoss: 0,
    rtt: 0,
    jitter: 0,
    availableBitrate: 0,
    decodeScore: 100,
    framesDroppedRate: 0,
    pliCountDelta: 0,
  });
  
  const lastLevelRef = useRef<NetworkQualityLevel>('excellent');
  const lastQualityRef = useRef<NetworkQualityScore>(quality);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingQualityRef = useRef<NetworkQualityScore | null>(null);
  const isCheckingRef = useRef(false);
  const isMountedRef = useRef(true);
  const rawStatsRef = useRef<NetworkQualityScore>(quality);
  const prevPacketsLostRef = useRef(0);
  const prevPacketsReceivedRef = useRef(0);
  const prevFramesDroppedRef = useRef(0);
  const prevFramesDecodedRef = useRef(0);
  const prevPliCountRef = useRef(0);

  const calculateLevel = useCallback((score: number): NetworkQualityLevel => {
    if (score >= finalConfig.scoreThresholds.excellent) return 'excellent';
    if (score >= finalConfig.scoreThresholds.good) return 'good';
    if (score >= finalConfig.scoreThresholds.fair) return 'fair';
    return 'poor';
  }, [finalConfig.scoreThresholds]);

  const calculateNetworkScore = useCallback((
    packetLoss: number,
    rtt: number,
    jitter: number,
    availableBitrate: number
  ): number => {
    const lossScore = Math.max(0, 40 - (packetLoss * 2));
    const rttScore = Math.max(0, 30 - (rtt / 500) * 30);
    const jitterScore = Math.max(0, 20 - (jitter / 100) * 20);
    const bitrateScore = Math.min(10, (availableBitrate / 1000000) * 10);
    return Math.round(lossScore + rttScore + jitterScore + bitrateScore);
  }, []);

  const calculateDecodeScore = useCallback((
    framesDroppedRate: number,
    pliCountDelta: number
  ): number => {
    const dropScore = Math.max(0, 60 - (framesDroppedRate * 1200));
    const pliScore = Math.max(0, 40 - (pliCountDelta * 13));
    return Math.round(dropScore + pliScore);
  }, []);

  useEffect(() => {
    if (!room) return;
    isMountedRef.current = true;

    const checkNetworkQuality = async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        if (!isMountedRef.current) return;
        const participants = Array.from(room.remoteParticipants.values());
        const localParticipant = room.localParticipant;
        
        let totalPacketsLost = 0;
        let totalPacketsReceived = 0;
        const rtts: number[] = [];
        const jitters: number[] = [];
        let availableBitrate = 0;
        let totalFramesDropped = 0;
        let totalFramesDecoded = 0;
        let totalPliCount = 0;

        for (const participant of participants) {
          if (!isMountedRef.current) return;
          for (const [, publication] of participant.trackPublications) {
            if (!isMountedRef.current) return;
            const track = publication.track;
            if (track) {
              const stats = await track.getRTCStatsReport?.();
              if (!isMountedRef.current) return;
              if (stats) {
                stats.forEach((stat) => {
                  const s = stat as Record<string, unknown>;
                  if (stat.type === 'inbound-rtp') {
                    totalPacketsLost += (s.packetsLost as number) || 0;
                    totalPacketsReceived += (s.packetsReceived as number) || 0;
                    if (s.jitter !== undefined) {
                      jitters.push((s.jitter as number) * 1000);
                    }
                    if (s.kind === 'video') {
                      totalFramesDropped += (s.framesDropped as number) || 0;
                      totalFramesDecoded += (s.framesDecoded as number) || 0;
                      totalPliCount += (s.pliCount as number) || 0;
                    }
                  }
                });
              }
            }
          }
        }

        for (const [, publication] of localParticipant.trackPublications) {
          if (!isMountedRef.current) return;
          const track = publication.track;
          if (track) {
            const stats = await track.getRTCStatsReport?.();
            if (!isMountedRef.current) return;
            if (stats) {
                stats.forEach((stat) => {
                  const s = stat as Record<string, unknown>;
                  if (stat.type === 'candidate-pair' && s.state === 'succeeded') {
                    if (typeof s.currentRoundTripTime === 'number') {
                      rtts.push(s.currentRoundTripTime * 1000);
                    }
                    if (typeof s.availableIncomingBitrate === 'number') {
                      availableBitrate = Math.max(availableBitrate, s.availableIncomingBitrate as number);
                    }
                  }
                });
            }
          }
        }

        const deltaLost = Math.max(0, totalPacketsLost - prevPacketsLostRef.current);
        const deltaReceived = Math.max(0, totalPacketsReceived - prevPacketsReceivedRef.current);
        prevPacketsLostRef.current = totalPacketsLost;
        prevPacketsReceivedRef.current = totalPacketsReceived;

        const deltaFramesDropped = Math.max(0, totalFramesDropped - prevFramesDroppedRef.current);
        const deltaFramesDecoded = Math.max(0, totalFramesDecoded - prevFramesDecodedRef.current);
        const deltaPliCount = Math.max(0, totalPliCount - prevPliCountRef.current);
        prevFramesDroppedRef.current = totalFramesDropped;
        prevFramesDecodedRef.current = totalFramesDecoded;
        prevPliCountRef.current = totalPliCount;

        const packetLoss = deltaLost + deltaReceived > 0
          ? (deltaLost / (deltaLost + deltaReceived)) * 100
          : 0;
        const framesDroppedRate = deltaFramesDropped + deltaFramesDecoded > 0
          ? deltaFramesDropped / (deltaFramesDropped + deltaFramesDecoded)
          : 0;
        const avgRtt = rtts.length > 0 
          ? rtts.reduce((a, b) => a + b, 0) / rtts.length 
          : 0;
        const avgJitter = jitters.length > 0 
          ? jitters.reduce((a, b) => a + b, 0) / jitters.length 
          : 0;

        const netScore = calculateNetworkScore(packetLoss, avgRtt, avgJitter, availableBitrate);
        const decodeScore = calculateDecodeScore(framesDroppedRate, deltaPliCount);
        const score = Math.min(netScore, decodeScore);
        const level = calculateLevel(score);

        const newQuality: NetworkQualityScore = {
          score,
          level,
          packetLoss: Math.round(packetLoss * 10) / 10,
          rtt: Math.round(avgRtt),
          jitter: Math.round(avgJitter),
          availableBitrate: Math.round(availableBitrate),
          decodeScore,
          framesDroppedRate: Math.round(framesDroppedRate * 1000) / 10,
          pliCountDelta: deltaPliCount,
        };

        if (level !== lastLevelRef.current) {
          pendingQualityRef.current = newQuality;

          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          debounceTimerRef.current = setTimeout(() => {
            if (pendingQualityRef.current && isMountedRef.current) {
              lastLevelRef.current = pendingQualityRef.current.level;
              const shouldPush =
                pendingQualityRef.current.level !== lastQualityRef.current.level ||
                Math.abs(pendingQualityRef.current.score - lastQualityRef.current.score) > 5;
              if (shouldPush) {
                lastQualityRef.current = pendingQualityRef.current;
                setQuality(pendingQualityRef.current);
              }
            }
          }, finalConfig.debounceMs);
        } else {
          if (isMountedRef.current) {
            const shouldPush =
              newQuality.level !== lastQualityRef.current.level ||
              Math.abs(newQuality.score - lastQualityRef.current.score) > 5;
            if (shouldPush) {
              lastQualityRef.current = newQuality;
              setQuality(newQuality);
            }
          }
          pendingQualityRef.current = null;
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
          }
        }
        rawStatsRef.current = newQuality;
      } catch (error) {
        logger.warn('[useNetworkQuality] Failed to get stats:', error);
      } finally {
        isCheckingRef.current = false;
      }
    };

    checkNetworkQuality();
    const interval = setInterval(checkNetworkQuality, finalConfig.checkIntervalMs);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [room, calculateNetworkScore, calculateDecodeScore, calculateLevel, finalConfig]);

  return quality;
}

export function getQualityLevelInfo(level: NetworkQualityLevel) {
  const info = {
    excellent: {
      icon: '🟢',
      label: 'Excellent',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      description: 'Connection is stable and fast',
    },
    good: {
      icon: '🟡',
      label: 'Good',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      description: 'Connection is working well',
    },
    fair: {
      icon: '🟠',
      label: 'Fair',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      description: 'Video quality may be reduced',
    },
    poor: {
      icon: '🔴',
      label: 'Poor',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      description: 'Experiencing connection issues',
    },
  };
  
  return info[level];
}
