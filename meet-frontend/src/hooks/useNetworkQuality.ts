import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRoomContext } from '@livekit/components-react';

export type NetworkQualityLevel = 'excellent' | 'good' | 'fair' | 'poor';

export type NetworkQualityScore = {
  score: number;
  level: NetworkQualityLevel;
  packetLoss: number;
  rtt: number;
  jitter: number;
  availableBitrate: number;
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
  const finalConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  const room = useRoomContext();
  
  const [quality, setQuality] = useState<NetworkQualityScore>({
    score: 100,
    level: 'excellent',
    packetLoss: 0,
    rtt: 0,
    jitter: 0,
    availableBitrate: 0,
  });
  
  const lastLevelRef = useRef<NetworkQualityLevel>('excellent');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingQualityRef = useRef<NetworkQualityScore | null>(null);
  const isCheckingRef = useRef(false);
  const isMountedRef = useRef(true);

  const calculateLevel = useCallback((score: number): NetworkQualityLevel => {
    if (score >= finalConfig.scoreThresholds.excellent) return 'excellent';
    if (score >= finalConfig.scoreThresholds.good) return 'good';
    if (score >= finalConfig.scoreThresholds.fair) return 'fair';
    return 'poor';
  }, [finalConfig.scoreThresholds]);

  const calculateScore = useCallback((
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

  useEffect(() => {
    if (!room) return;
    isMountedRef.current = true;

    const checkNetworkQuality = async () => {
      // Prevent overlapping async calls
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        // Check if unmounted before starting
        if (!isMountedRef.current) return;
        const participants = Array.from(room.remoteParticipants.values());
        const localParticipant = room.localParticipant;
        
        let totalPacketsLost = 0;
        let totalPacketsReceived = 0;
        const rtts: number[] = [];
        const jitters: number[] = [];
        let availableBitrate = 0;

        // Get stats from remote participants
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
                  }
                });
              }
            }
          }
        }

        // Get local stats for RTT
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
                }
                if (stat.type === 'outbound-rtp' && s.bitrate) {
                  availableBitrate = Math.max(availableBitrate, s.bitrate as number);
                }
              });
            }
          }
        }

        const packetLoss = totalPacketsReceived > 0 
          ? (totalPacketsLost / (totalPacketsLost + totalPacketsReceived)) * 100 
          : 0;
        const avgRtt = rtts.length > 0 
          ? rtts.reduce((a, b) => a + b, 0) / rtts.length 
          : 0;
        const avgJitter = jitters.length > 0 
          ? jitters.reduce((a, b) => a + b, 0) / jitters.length 
          : 0;

        const score = calculateScore(packetLoss, avgRtt, avgJitter, availableBitrate);
        const level = calculateLevel(score);

        const newQuality: NetworkQualityScore = {
          score,
          level,
          packetLoss: Math.round(packetLoss * 10) / 10,
          rtt: Math.round(avgRtt),
          jitter: Math.round(avgJitter),
          availableBitrate: Math.round(availableBitrate),
        };

        // Debounce level changes
        if (level !== lastLevelRef.current) {
          pendingQualityRef.current = newQuality;
          
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          
          debounceTimerRef.current = setTimeout(() => {
            if (pendingQualityRef.current && isMountedRef.current) {
              lastLevelRef.current = pendingQualityRef.current.level;
              setQuality(pendingQualityRef.current);
            }
          }, finalConfig.debounceMs);
        } else {
          if (isMountedRef.current) {
            setQuality(newQuality);
          }
          pendingQualityRef.current = null;
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
          }
        }
      } catch (error) {
        console.warn('[useNetworkQuality] Failed to get stats:', error);
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
  }, [room, calculateScore, calculateLevel, finalConfig]);

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
