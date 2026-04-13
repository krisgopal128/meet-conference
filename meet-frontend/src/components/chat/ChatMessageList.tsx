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
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.length === 0 && (
        <div className="text-center text-surface-500 text-sm py-8">
          No messages yet. Start the conversation!
        </div>
      )}
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex flex-col ${
            message.senderIdentity === localParticipant?.identity ? 'items-end' : 'items-start'
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
              localParticipantIdentity={localParticipant?.identity ?? null}
              onVote={onVote}
              onClosePoll={onClosePoll}
            />
          )}

          {/* Regular Message */}
          {message.type !== 'poll' && (
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                message.senderIdentity === localParticipant?.identity
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-700 text-surface-100'
              }`}
            >
              {renderMessageWithMentions(message.message)}
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// Sub-component for poll messages
interface PollMessageProps {
  message: ChatMessage;
  localParticipantIdentity: string | null;
  onVote: (pollId: string, optionId: string) => void;
  onClosePoll: (pollId: string) => void;
}

function PollMessage({ message, localParticipantIdentity, onVote, onClosePoll }: PollMessageProps) {
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
}
