import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNetworkQuality, NetworkQualityLevel, getQualityLevelInfo } from './useNetworkQuality';
import { useCallSizeConfig } from './useCallSizeConfig';

export type QualityMode = 'auto' | 'highQuality' | 'dataSaver' | 'audioOnly';

export interface AdaptiveQualityState {
  // Current effective mode
  effectiveMode: QualityMode;
  
  // Network quality info
  networkLevel: NetworkQualityLevel;
  networkScore: number;
  networkInfo: ReturnType<typeof getQualityLevelInfo>;
  
  // Call size info
  participantCount: number;
  isLargeCall: boolean;
  
  // Whether quality was auto-adjusted
  isAutoAdjusted: boolean;
  
  // Reason for current mode
  reason: string;
}

interface AdaptiveQualityConfig {
  enabled: boolean;
  userPreferredMode?: QualityMode;
  onModeChange?: (mode: QualityMode, reason: string) => void;
}

const DEFAULT_ADAPTIVE_CONFIG: AdaptiveQualityConfig = {
  enabled: true,
};

export function useAdaptiveQuality(config: Partial<AdaptiveQualityConfig> = {}) {
  const fullConfig = useMemo(() => ({ ...DEFAULT_ADAPTIVE_CONFIG, ...config }), [config]);
  const networkQuality = useNetworkQuality();
  const callSizeConfig = useCallSizeConfig();
  
  // Extract primitive values to avoid object reference changes causing re-renders
  const networkScore = networkQuality.score;
  const networkLevel = networkQuality.level;
  const isLargeCall = callSizeConfig.isLargeCall;
  const participantCount = callSizeConfig.participantCount;
  
  const [effectiveMode, setEffectiveMode] = useState<QualityMode>('auto');
  const [isAutoAdjusted, setIsAutoAdjusted] = useState(false);
  const [reason, setReason] = useState('');
  
  const lastNotifiedModeRef = useRef<QualityMode>('auto');

  const determineMode = useCallback((): { mode: QualityMode; reason: string } => {
    // If user explicitly set a mode (not auto), respect it
    if (fullConfig.userPreferredMode && fullConfig.userPreferredMode !== 'auto') {
      return {
        mode: fullConfig.userPreferredMode,
        reason: 'User selected',
      };
    }

    // Auto mode: determine based on network quality
    if (networkScore < 40 || networkLevel === 'poor') {
      return {
        mode: 'audioOnly',
        reason: 'Poor network connection detected',
      };
    }

    if (networkScore < 60 || networkLevel === 'fair') {
      return {
        mode: 'dataSaver',
        reason: 'Network quality is reduced',
      };
    }

    // Good/Excellent network
    if (isLargeCall) {
      return {
        mode: 'dataSaver',
        reason: `Large call (${participantCount} participants)`,
      };
    }

    return {
      mode: 'highQuality',
      reason: 'Good network connection',
    };
  }, [networkScore, networkLevel, isLargeCall, participantCount, fullConfig.userPreferredMode]);

  useEffect(() => {
    if (!fullConfig.enabled) return;

    const { mode, reason: modeReason } = determineMode();
    
    if (mode !== lastNotifiedModeRef.current) {
      const isAdjusted = fullConfig.userPreferredMode === 'auto' || !fullConfig.userPreferredMode;
      
      setEffectiveMode(mode);
      setReason(modeReason);
      setIsAutoAdjusted(isAdjusted);

      lastNotifiedModeRef.current = mode;
      fullConfig.onModeChange?.(mode, modeReason);
    }
  }, [determineMode, fullConfig]);

  // Build network info
  const networkInfo = getQualityLevelInfo(networkQuality.level);

  const state: AdaptiveQualityState = {
    effectiveMode,
    networkLevel: networkQuality.level,
    networkScore: networkQuality.score,
    networkInfo,
    participantCount: callSizeConfig.participantCount,
    isLargeCall: callSizeConfig.isLargeCall,
    isAutoAdjusted,
    reason,
  };

  return state;
}

export function getModeLabel(mode: QualityMode): string {
  const labels: Record<QualityMode, string> = {
    auto: 'Auto',
    highQuality: 'High Quality',
    dataSaver: 'Data Saver',
    audioOnly: 'Audio Only',
  };
  return labels[mode];
}

export function getModeDescription(mode: QualityMode): string {
  const descriptions: Record<QualityMode, string> = {
    auto: 'Automatically adjusts based on network',
    highQuality: 'Best video quality (1080p, 30fps)',
    dataSaver: 'Reduced quality to save data (720p, 24fps)',
    audioOnly: 'Audio only, no video',
  };
  return descriptions[mode];
}
