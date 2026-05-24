import { memo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Lock, BarChart3, Check } from 'lucide-react';
import type { ChatMessage } from '../../types';
import type { LocalParticipant } from 'livekit-client';
import { meetingRoomConfig } from '../../config/meetingRoomConfig';
import { cn } from '../../utils/cn';
import { renderMessageWithMentions } from './chatUtils';

interface ChatMessageListProps {
  messages: ChatMessage[];
  localParticipant: LocalParticipant | null;
  showChatTimestamps: boolean;
  onVote: (pollId: string, optionId: string) => void;
  onClosePoll: (pollId: string) => void;
  bottomRef: React.RefObject<HTMLDivElement>;
}

export function ChatMessageList({
  messages,
  localParticipant,
  showChatTimestamps,
  onVote,
  onClosePoll,
  bottomRef,
}: ChatMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
    }
  }, [messages.length, virtualizer]);

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto p-3">
      {messages.length === 0 ? (
        <div className="text-center text-surface-500 text-sm py-8">
          No messages yet. Start the conversation!
        </div>
      ) : (
        <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const message = messages[virtualItem.index];
            return (
              <div
                key={message.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <ChatMessageItem
                  message={message}
                  localParticipantIdentity={localParticipant?.identity ?? null}
                  showChatTimestamps={showChatTimestamps}
                  onVote={onVote}
                  onClosePoll={onClosePoll}
                />
              </div>
            );
          })}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// Memoized individual message item
interface ChatMessageItemProps {
  message: ChatMessage;
  localParticipantIdentity: string | null;
  showChatTimestamps: boolean;
  onVote: (pollId: string, optionId: string) => void;
  onClosePoll: (pollId: string) => void;
}

const ChatMessageItem = memo(function ChatMessageItem({
  message,
  localParticipantIdentity,
  showChatTimestamps,
  onVote,
  onClosePoll,
}: ChatMessageItemProps) {
  return (
    <div
      className={`flex flex-col ${
        message.senderIdentity === localParticipantIdentity ? 'items-end' : 'items-start'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-surface-500">{message.senderName}</span>
        {message.isPrivate && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-500/15 px-2 py-0.5 text-[10px] font-medium text-warning-400">
            <Lock size={10} />
            Moderators
          </span>
        )}
        {message.type === 'poll' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-medium text-brand-400">
            <BarChart3 size={10} />
            Poll
          </span>
        )}
        {meetingRoomConfig.features.chatTimestampsToggle && showChatTimestamps && (
          <span className="text-[10px] text-surface-500">
            {message.sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Poll Message */}
      {message.type === 'poll' && message.poll && (
        <PollMessage
          message={message}
          localParticipantIdentity={localParticipantIdentity}
          onVote={onVote}
          onClosePoll={onClosePoll}
        />
      )}

      {/* Regular Message */}
      {message.type !== 'poll' && (
        <div
          className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
            message.senderIdentity === localParticipantIdentity
              ? 'bg-brand-600 text-white'
              : 'bg-surface-700 text-surface-100'
          }`}
        >
          {renderMessageWithMentions(message.message)}
        </div>
      )}
    </div>
  );
});

// Sub-component for poll messages (memoized)
interface PollMessageProps {
  message: ChatMessage;
  localParticipantIdentity: string | null;
  onVote: (pollId: string, optionId: string) => void;
  onClosePoll: (pollId: string) => void;
}

const PollMessage = memo(function PollMessage({ message, localParticipantIdentity, onVote, onClosePoll }: PollMessageProps) {
  if (!message.poll) return null;

  const poll = message.poll;
  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);

  return (
    <div className="max-w-[90%] w-full bg-surface-700 rounded-lg border border-surface-600 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-surface-600">
        <p className="text-sm font-medium text-surface-100">{poll.question}</p>
        {poll.isClosed && (
          <span className="text-[10px] text-surface-400 mt-1 block">Poll closed</span>
        )}
      </div>
      <div className="p-2 space-y-1.5">
        {poll.options.map((option) => {
          const votePercent = totalVotes > 0 ? Math.round((option.votes.length / totalVotes) * 100) : 0;
          const hasVoted = localParticipantIdentity && option.votes.includes(localParticipantIdentity);

          return (
            <button
              key={option.id}
              onClick={() => {
                if (!poll.isClosed) {
                  onVote(poll.id, option.id);
                }
              }}
              disabled={poll.isClosed}
              className={cn(
                'relative w-full text-left px-3 py-2 rounded-lg text-sm transition-all overflow-hidden',
                poll.isClosed ? 'cursor-default' : 'cursor-pointer hover:bg-surface-600',
                hasVoted ? 'bg-brand-500/20 border border-brand-500/50' : 'bg-surface-600/50 border border-transparent'
              )}
            >
              {/* Progress bar background */}
              <div
                className="absolute inset-0 bg-brand-500/20 transition-all"
                style={{ width: `${votePercent}%` }}
              />
              <div className="relative flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {hasVoted && <Check size={14} className="text-brand-400" />}
                  <span className="text-surface-100">{option.text}</span>
                </span>
                <span className="text-xs text-surface-400">{votePercent}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="px-3 py-2 border-t border-surface-600 flex items-center justify-between">
        <span className="text-[10px] text-surface-400">
          {totalVotes} votes
          {poll.allowMultiple && ' • Multiple choice'}
        </span>
        {!poll.isClosed && poll.createdBy === localParticipantIdentity && (
          <button
            onClick={() => { void onClosePoll(poll.id); }}
            className="text-[10px] text-surface-400 hover:text-surface-200 transition-colors"
          >
            Close poll
          </button>
        )}
      </div>
    </div>
  );
});
