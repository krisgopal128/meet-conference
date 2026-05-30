import { Clock, X } from 'lucide-react';
import { meetingRoomConfig } from '../../config/meetingRoomConfig';

interface ChatHeaderProps {
  showChatTimestamps: boolean;
  onToggleTimestamps: () => void;
  onCloseChat: () => void;
  typingLabel: string;
}

export function ChatHeader({
  showChatTimestamps,
  onToggleTimestamps,
  onCloseChat,
  typingLabel,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
      <div>
        <span className="font-semibold text-surface-100">Chat</span>
        {meetingRoomConfig.features.typingIndicator && typingLabel && (
          <p className="text-xs text-brand-400 mt-0.5 animate-pulse">{typingLabel}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {meetingRoomConfig.features.chatTimestampsToggle && (
          <button
            onClick={onToggleTimestamps}
            className={`p-1.5 rounded-lg transition-colors ${showChatTimestamps ? 'bg-surface-700 text-surface-100' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700'}`}
            aria-label="Toggle timestamps"
            title="Toggle timestamps"
          >
            <Clock size={16} />
          </button>
        )}
        <button
          onClick={onCloseChat}
          className="hidden md:block p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors"
          aria-label="Close chat"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
