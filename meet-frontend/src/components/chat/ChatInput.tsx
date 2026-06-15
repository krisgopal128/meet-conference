import React from 'react';
import { Send, Lock, BarChart3, AtSign } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { MentionableParticipant } from './chatUtils';

interface ChatInputProps {
  input: string;
  onInputChange: (value: string, selectionStart: number | null) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSendMessage: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  // Private message toggle
  showPrivateToggle: boolean;
  sendPrivateToModerators: boolean;
  onTogglePrivate: (checked: boolean) => void;
  // Poll button
  showPollCreator: boolean;
  onTogglePollCreator: () => void;
  // Mention autocomplete
  showMentionList: boolean;
  filteredParticipants: MentionableParticipant[];
  selectedMentionIndex: number;
  mentionListRef: React.RefObject<HTMLDivElement>;
  onSelectMention: (participant: MentionableParticipant) => void;
  onInsertAtSign: () => void;
  disabled?: boolean;
}

export const ChatInput = React.memo(function ChatInput({
  input,
  onInputChange,
  onKeyDown,
  onSendMessage,
  inputRef,
  showPrivateToggle,
  sendPrivateToModerators,
  onTogglePrivate,
  showPollCreator,
  onTogglePollCreator,
  showMentionList,
  filteredParticipants,
  selectedMentionIndex,
  mentionListRef,
  onSelectMention,
  onInsertAtSign,
  disabled = false,
}: ChatInputProps) {
  return (
    <div className="p-3 border-t border-surface-700">
      {showPrivateToggle && (
        <label className="mb-3 flex items-center justify-between rounded-lg border border-surface-600 bg-surface-700/40 px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-surface-200">
            <Lock size={14} className="text-warning-400" />
            <span>Private to moderators</span>
          </div>
          <input
            type="checkbox"
            checked={sendPrivateToModerators}
            disabled={disabled}
            onChange={(event) => onTogglePrivate(event.target.checked)}
            className="h-4 w-4 rounded border-surface-500 text-brand-500 focus:ring-brand-500"
          />
        </label>
      )}

      <div className="flex gap-2 relative">
        {/* Mention autocomplete dropdown */}
        {showMentionList && filteredParticipants.length > 0 && (
          <MentionDropdown
            mentionListRef={mentionListRef}
            filteredParticipants={filteredParticipants}
            selectedMentionIndex={selectedMentionIndex}
            onSelectMention={onSelectMention}
          />
        )}

        {/* Poll button */}
        <button
          onClick={onTogglePollCreator}
          disabled={disabled}
          className={cn(
            'p-2.5 rounded-lg transition-colors',
            showPollCreator
              ? 'bg-brand-500 text-white'
              : 'bg-surface-700 text-surface-400 hover:text-surface-200 hover:bg-surface-600',
            disabled && 'opacity-50 cursor-not-allowed hover:bg-surface-700 hover:text-surface-400'
          )}
          aria-label="Create poll"
          title="Create poll"
        >
          <BarChart3 size={16} />
        </button>
        
        {/* @ Mention button */}
        <button
          onClick={onInsertAtSign}
          disabled={disabled}
          className={cn(
            'p-2.5 rounded-lg bg-surface-700 text-surface-400 hover:text-surface-200 hover:bg-surface-600 transition-colors',
            disabled && 'opacity-50 cursor-not-allowed hover:bg-surface-700 hover:text-surface-400'
          )}
          aria-label="Mention someone"
          title="Mention someone (@)"
        >
          <AtSign size={16} />
        </button>
        
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(event) => {
            void onInputChange(event.target.value, event.target.selectionStart);
          }}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={sendPrivateToModerators ? 'Message moderators…' : 'Message everyone…'}
          className="flex-1 bg-surface-700 text-surface-100 text-sm rounded-lg px-3 py-2 outline-none border border-surface-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 placeholder:text-surface-500"
        />
        
        <button
          onClick={() => { void onSendMessage(); }}
          disabled={disabled || !input.trim()}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2.5 rounded-lg transition-colors"
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
});

// Sub-component for mention dropdown
interface MentionDropdownProps {
  mentionListRef: React.RefObject<HTMLDivElement>;
  filteredParticipants: MentionableParticipant[];
  selectedMentionIndex: number;
  onSelectMention: (participant: MentionableParticipant) => void;
}

function MentionDropdown({
  mentionListRef,
  filteredParticipants,
  selectedMentionIndex,
  onSelectMention,
}: MentionDropdownProps) {
  return (
    <div
      ref={mentionListRef}
      className="absolute bottom-full left-0 right-0 mb-1 bg-surface-700 border border-surface-600 rounded-lg shadow-lg overflow-hidden z-50 max-h-48 overflow-y-auto"
    >
      <div className="px-2 py-1.5 text-xs text-surface-400 border-b border-surface-600 flex items-center gap-1">
        <AtSign size={12} />
        Mention someone
      </div>
      {filteredParticipants.map((participant, index) => (
        <button
          key={participant.identity}
          onClick={() => onSelectMention(participant)}
          className={cn(
            'w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors',
            index === selectedMentionIndex
              ? 'bg-brand-500/20 text-surface-100'
              : 'text-surface-200 hover:bg-surface-600'
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{participant.name}</div>
            {participant.name !== participant.identity && (
              <div className="text-xs text-surface-400 truncate">{participant.identity}</div>
            )}
          </div>
          {participant.isModerator && (
            <span className="text-[10px] bg-warning-500/20 text-warning-400 px-1.5 py-0.5 rounded">
              {participant.role === 'host' ? 'Host' : 'Co-host'}
            </span>
          )}
        </button>
      ))}
      <div className="px-2 py-1 text-[10px] text-surface-500 border-t border-surface-600">
        ↑↓ to navigate • Tab/Enter to select • Esc to close
      </div>
    </div>
  );
}
