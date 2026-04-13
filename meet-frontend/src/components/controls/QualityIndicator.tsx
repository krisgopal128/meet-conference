import { useState, useRef, useEffect } from 'react';
import { 
  WifiOff, 
  Signal, 
  SignalLow, 
  SignalMedium,
  Users,
  ChevronDown,
} from 'lucide-react';
import { 
  useAdaptiveQuality, 
  getModeLabel, 
  getModeDescription,
  type QualityMode,
} from '../../hooks/useAdaptiveQuality';
import { getQualityLevelInfo } from '../../hooks/useNetworkQuality';
import { useUIActions, useSelectedQualityMode } from '../../store/roomStore';

interface QualityIndicatorProps {
  className?: string;
}

export function QualityIndicator({ className = '' }: QualityIndicatorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Connect to roomStore for global quality mode state
  const { setQualityMode: setGlobalQualityMode } = useUIActions();
  const selectedQualityMode = useSelectedQualityMode();
  
  // Sync local state with global state (convert from roomStore's QualityModeName to our QualityMode)
  const userSelectedMode = selectedQualityMode as QualityMode;

  const adaptiveState = useAdaptiveQuality({
    enabled: true,
    userPreferredMode: userSelectedMode,
    onModeChange: (mode, reason) => {
      console.log(`[QualityIndicator] Mode changed to ${mode}: ${reason}`);
    },
  });

  const { 
    networkLevel, 
    networkScore, 
    networkInfo,
    participantCount,
    isLargeCall,
    isAutoAdjusted,
    effectiveMode,
    reason,
  } = adaptiveState;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleModeSelect = (mode: QualityMode) => {
    // Update global roomStore state - this is what ConferenceRoom reads
    setGlobalQualityMode(mode as 'auto' | 'highQuality' | 'dataSaver' | 'audioOnly');
    setShowDropdown(false);
  };

  const getNetworkIcon = () => {
    switch (networkLevel) {
      case 'excellent':
        return <Signal className="w-4 h-4 text-green-500" />;
      case 'good':
        return <SignalMedium className="w-4 h-4 text-yellow-500" />;
      case 'fair':
        return <SignalLow className="w-4 h-4 text-orange-500" />;
      case 'poor':
        return <WifiOff className="w-4 h-4 text-red-500" />;
    }
  };

  const modes: QualityMode[] = ['auto', 'highQuality', 'dataSaver', 'audioOnly'];

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Main Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg
          bg-surface-100 dark:bg-surface-800
          hover:bg-surface-200 dark:hover:bg-surface-700
          transition-colors duration-200
          ${networkLevel === 'poor' || networkLevel === 'fair' ? 'ring-2 ring-orange-500/50' : ''}
        `}
        title={`Network: ${networkInfo.label} | Mode: ${getModeLabel(effectiveMode)}`}
      >
        {getNetworkIcon()}
        
        {/* Network degraded indicator */}
        {(networkLevel === 'poor' || networkLevel === 'fair') && (
          <span className="text-xs font-medium text-orange-500">
            {networkInfo.label}
          </span>
        )}
        
        {/* Large call indicator */}
        {isLargeCall && networkLevel !== 'poor' && networkLevel !== 'fair' && (
          <div className="flex items-center gap-1 text-xs text-surface-500">
            <Users className="w-3 h-3" />
            <span>{participantCount}</span>
          </div>
        )}
        
        <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="
          absolute right-0 top-full mt-2 w-72
          bg-white dark:bg-surface-800
          rounded-lg shadow-xl border border-surface-200 dark:border-surface-700
          overflow-hidden z-50
        ">
          {/* Network Status Header */}
          <div className={`px-4 py-3 ${networkInfo.bgColor}`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{networkInfo.icon}</span>
              <div>
                <div className={`font-medium ${networkInfo.color}`}>
                  {networkInfo.label} ({networkScore}/100)
                </div>
                <div className="text-xs text-surface-500">
                  {networkInfo.description}
                </div>
              </div>
            </div>
            
            {/* Current status reason */}
            {isAutoAdjusted && reason && (
              <div className="mt-2 text-xs text-surface-600 dark:text-surface-400">
                {reason}
              </div>
            )}
          </div>

          {/* Mode Selection */}
          <div className="p-2">
            <div className="text-xs font-medium text-surface-400 uppercase px-3 py-2">
              Quality Mode
            </div>
            
            {modes.map((mode) => {
              const isSelected = userSelectedMode === mode;
              const isActive = effectiveMode === mode;
              
              return (
                <button
                  key={mode}
                  onClick={() => handleModeSelect(mode)}
                  className={`
                    w-full text-left px-3 py-2 rounded-md
                    flex items-center justify-between
                    transition-colors duration-150
                    ${isSelected 
                      ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' 
                      : 'hover:bg-surface-100 dark:hover:bg-surface-700'
                    }
                  `}
                >
                  <div>
                    <div className="font-medium">{getModeLabel(mode)}</div>
                    <div className="text-xs text-surface-500">
                      {getModeDescription(mode)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isActive && !isSelected && (
                      <span className="text-xs px-2 py-0.5 bg-surface-200 dark:bg-surface-600 rounded">
                        active
                      </span>
                    )}
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-brand-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Call Info Footer */}
          <div className="px-4 py-2 bg-surface-50 dark:bg-surface-900 border-t border-surface-200 dark:border-surface-700">
            <div className="flex items-center justify-between text-xs text-surface-500">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {participantCount} participants
              </span>
              <span className={isLargeCall ? 'text-orange-500' : ''}>
                {isLargeCall ? 'Large call (optimized)' : 'Small call'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact version for participant tiles
export function NetworkBadge({ 
  level, 
  showLabel = false,
  className = '' 
}: { 
  level: 'excellent' | 'good' | 'fair' | 'poor';
  showLabel?: boolean;
  className?: string;
}) {
  const info = getQualityLevelInfo(level);
  
  // Only show for fair/poor
  if (level === 'excellent' || level === 'good') {
    return null;
  }

  return (
    <div 
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full
        ${info.bgColor} ${info.color}
        text-xs font-medium cursor-default
        ${className}
      `}
      title={info.description}
    >
      <span>{info.icon}</span>
      {showLabel && <span>{info.label}</span>}
    </div>
  );
}
