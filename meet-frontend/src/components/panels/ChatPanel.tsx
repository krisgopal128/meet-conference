import { useState, useRef, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useLocalParticipant, useParticipants } from '@livekit/components-react';
import {
  useMessages,
  useShowChatTimestamps,
  useTypingParticipants,
  useUserRole,
  useParticipantsCanChat,
  useUIActions,
  useChatActions,
  useHostId,
} from '../../store/roomStore';
import { isAuthenticated, roomsApi } from '../../services/api';
import { meetingRoomConfig } from '../../config/meetingRoomConfig';
import type { PollData } from '../../types';
import { ChatHeader } from '../chat/ChatHeader';
import { ChatMessageList } from '../chat/ChatMessageList';
import { ChatInput } from '../chat/ChatInput';
import { parseMentions, type MentionableParticipant } from '../chat/chatUtils';
import logger from '../../utils/logger';
import toast from 'react-hot-toast';

/** Lazy-loaded poll creator — only loaded when user opens it */
const PollCreator = lazy(() =>
  import('../chat/PollCreator').then((mod) => ({ default: mod.PollCreator }))
);

const chatPanelDraftCache = new Map<string, {
  input: string;
  sendPrivateToModerators: boolean;
  showPollCreator: boolean;
  pollQuestion: string;
  pollOptions: string[];
  allowMultiple: boolean;
}>();

// API response type for chat history messages
interface ChatHistoryMessage {
  id: string;
  sender_identity?: string;
  senderIdentity?: string;
  sender_name?: string;
  senderName?: string;
  content: string;
  created_at?: string;
  createdAt?: string;
}

interface ChatPanelProps {
  roomName?: string;
}

function getParticipantRole(metadata: string | undefined, hostId: string | null, identity: string): string {
  if (identity === hostId) return 'host';
  if (!metadata) return 'attendee';

  try {
    const parsed = JSON.parse(metadata) as { role?: string };
    return parsed.role || 'attendee';
  } catch {
    return 'attendee';
  }
}

export function ChatPanel({ roomName }: ChatPanelProps) {
  const draftKey = roomName || '__default__';
  const cachedDraft = chatPanelDraftCache.get(draftKey);
  // Optimized selectors
  const messages = useMessages();
  const showChatTimestamps = useShowChatTimestamps();
  const typingParticipants = useTypingParticipants();
  const role = useUserRole();
  const participantsCanChat = useParticipantsCanChat();
  const hostId = useHostId();

  // Action hooks (stable references)
  const { toggleChat, toggleChatTimestamps } = useUIActions();
  const { mergeMessages, setTypingParticipant, addMessage, votePoll, closePoll } = useChatActions();

  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [input, setInput] = useState(cachedDraft?.input || '');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sendPrivateToModerators, setSendPrivateToModerators] = useState(cachedDraft?.sendPrivateToModerators || false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const isModerator = role === 'host' || role === 'cohost' || localParticipant?.identity === hostId;
  const chatDisabled = !isModerator && !participantsCanChat;

  // Mention autocomplete state
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValueRef = useRef(input);
  inputValueRef.current = input;
  const mentionListRef = useRef<HTMLDivElement>(null);

  // Poll creation state
  const [showPollCreator, setShowPollCreator] = useState(cachedDraft?.showPollCreator || false);
  const [pollQuestion, setPollQuestion] = useState(cachedDraft?.pollQuestion || '');
  const [pollOptions, setPollOptions] = useState(cachedDraft?.pollOptions || ['', '']);
  const [allowMultiple, setAllowMultiple] = useState(cachedDraft?.allowMultiple || false);

  useEffect(() => {
    chatPanelDraftCache.set(draftKey, {
      input,
      sendPrivateToModerators,
      showPollCreator,
      pollQuestion,
      pollOptions,
      allowMultiple,
    });
  }, [allowMultiple, draftKey, input, pollOptions, pollQuestion, sendPrivateToModerators, showPollCreator]);

  // Build participant list for mentions with roles
  const mentionableParticipants = useMemo((): MentionableParticipant[] => {
    return participants
      .filter((p) => p.identity !== localParticipant?.identity)
      .map((p) => {
        const participantRole = getParticipantRole(p.metadata, hostId, p.identity);
        const isParticipantModerator = participantRole === 'host' || participantRole === 'cohost';
        return {
          identity: p.identity,
          name: p.name || p.identity,
          role: participantRole,
          isModerator: isParticipantModerator,
        };
      })
      .sort((a, b) => {
        // Sort moderators first, then alphabetically
        if (a.isModerator && !b.isModerator) return -1;
        if (!a.isModerator && b.isModerator) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [participants, localParticipant?.identity, hostId]);

  // Filter participants by mention query
  const filteredParticipants = useMemo(() => {
    if (!mentionQuery) return mentionableParticipants.slice(0, 6);
    const query = mentionQuery.toLowerCase();
    return mentionableParticipants
      .filter((p) => p.name.toLowerCase().includes(query) || p.identity.toLowerCase().includes(query))
      .slice(0, 6);
  }, [mentionableParticipants, mentionQuery]);

  // Handle mention selection
  const selectMention = useCallback((participant: MentionableParticipant) => {
    const beforeMention = input.slice(0, mentionStartPos);
    const afterMention = input.slice(input.indexOf(mentionQuery, mentionStartPos) + mentionQuery.length);
    const newText = `${beforeMention}@${participant.name} ${afterMention}`;
    setInput(newText);
    setShowMentionList(false);
    setMentionQuery('');
    inputRef.current?.focus();
  }, [input, mentionStartPos, mentionQuery]);

  // Handle input change with mention detection
  const handleInputChangeWithMentions = useCallback(async (nextValue: string, selectionStart: number | null) => {
    setInput(nextValue);

    // Detect @ mentions
    const cursorPos = selectionStart ?? nextValue.length;
    const textBeforeCursor = nextValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there's a space between @ and cursor (which would end the mention)
      if (!textAfterAt.includes(' ') && textAfterAt.length < 30) {
        setMentionStartPos(lastAtIndex);
        setMentionQuery(textAfterAt);
        setShowMentionList(true);
        setSelectedMentionIndex(0);
      } else {
        setShowMentionList(false);
      }
    } else {
      setShowMentionList(false);
    }

    // Original typing indicator logic
    if (!localParticipant) return;

    const isTyping = nextValue.trim().length > 0;
    await publishTyping(isTyping);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    if (isTyping) {
      typingTimeoutRef.current = window.setTimeout(() => {
        void publishTyping(false).catch(() => undefined);
      }, meetingRoomConfig.chat.typingIndicatorTimeoutMs);
    }
  }, [localParticipant]);

  // Handle keyboard navigation in mention list
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentionList && filteredParticipants.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedMentionIndex((prev) => 
          prev < filteredParticipants.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedMentionIndex((prev) => 
          prev > 0 ? prev - 1 : filteredParticipants.length - 1
        );
        return;
      }
      if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
        event.preventDefault();
        selectMention(filteredParticipants[selectedMentionIndex]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowMentionList(false);
        return;
      }
    }

    // Regular send message
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }, [showMentionList, filteredParticipants, selectedMentionIndex, selectMention]);

  // Scroll selected mention into view
  useEffect(() => {
    if (showMentionList && mentionListRef.current) {
      const selectedElement = mentionListRef.current.children[selectedMentionIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedMentionIndex, showMentionList]);

  useEffect(() => {
    if (!meetingRoomConfig.chat.publicChatEnabled || !roomName || historyLoaded || !isAuthenticated()) {
      return;
    }

    const loadHistory = async () => {
      try {
        const response = await roomsApi.getChatHistory(roomName, meetingRoomConfig.chat.maxHistoryMessages);
        const history = (response.data.messages || []).map((message: ChatHistoryMessage) => ({
          id: message.id,
          senderIdentity: message.sender_identity || message.senderIdentity || 'unknown',
          senderName: message.sender_name || message.senderName || 'Unknown',
          message: message.content,
          sentAt: new Date(message.created_at || message.createdAt || Date.now()),
          type: 'chat' as const,
        }));
        mergeMessages(history);
      } catch (error) {
        logger.error('Failed to load room chat history:', error);
      toast.error('Failed to load chat history');
      } finally {
        setHistoryLoaded(true);
      }
    };

    void loadHistory();
  }, [roomName, historyLoaded, mergeMessages]);

  const visibleMessages = messages.filter((message) => {
    if (!message.isPrivate) {
      return true;
    }

    if (message.senderIdentity === localParticipant?.identity) {
      return true;
    }

    return message.recipientRole === 'moderator' && isModerator;
  });

  const activeTypers = Object.entries(typingParticipants)
    .filter(([identity]) => identity !== localParticipant?.identity)
    .map(([, name]) => name);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      if (localParticipant) {
        setTypingParticipant(localParticipant.identity, localParticipant.name || localParticipant.identity, false);
        void localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({
            type: 'typing',
            identity: localParticipant.identity,
            senderName: localParticipant.name || localParticipant.identity,
            isTyping: false,
          })),
          { reliable: true }
        ).catch(() => undefined);
      }
    };
  }, [localParticipant, setTypingParticipant]);

  async function publishTyping(isTyping: boolean) {
    if (!localParticipant || chatDisabled) {
      return;
    }

    setTypingParticipant(localParticipant.identity, localParticipant.name || localParticipant.identity, isTyping);
    await localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({
        type: 'typing',
        identity: localParticipant.identity,
        senderName: localParticipant.name || localParticipant.identity,
        isTyping,
      })),
      { reliable: true }
    );
  }

  async function sendMessage() {
    if (chatDisabled) {
      toast.error('Chat is disabled by the host');
      return;
    }

    if (!inputValueRef.current.trim() || !localParticipant) {
      return;
    }

    const trimmed = inputValueRef.current.trim();
    const isPrivate = meetingRoomConfig.chat.privateModeratorChatEnabled && sendPrivateToModerators && !isModerator;
    let persistedId = `${Date.now()}`;
    let sentAt = new Date().toISOString();
    let wasPersisted = false;

    // Parse mentions from the message
    const mentionedNames = parseMentions(trimmed);
    const mentionedIdentities = mentionedNames.map((name) => {
      const participant = mentionableParticipants.find(
        (p) => p.name.toLowerCase() === name.toLowerCase()
      );
      return participant?.identity;
    }).filter(Boolean) as string[];

    if (meetingRoomConfig.chat.persistPublicRoomChat && !isPrivate && roomName && isAuthenticated()) {
      try {
        const response = await roomsApi.sendChatMessage(roomName, trimmed);
        if (response.data.message) {
          persistedId = response.data.message.id;
          sentAt = response.data.message.created_at || response.data.message.createdAt || sentAt;
          wasPersisted = true;
        }
      } catch (error) {
        logger.error('Failed to persist room chat message:', error);
        toast.error('Failed to persist room chat message');
      }
    }

    const payload = {
      id: persistedId,
      type: isPrivate ? 'private_chat' as const : 'chat' as const,
      message: trimmed,
      senderIdentity: localParticipant.identity,
      senderName: localParticipant.name || localParticipant.identity,
      sentAt,
      isPrivate,
      recipientRole: isPrivate ? ('moderator' as const) : undefined,
      mentions: mentionedIdentities.length > 0 ? mentionedIdentities : undefined,
    };

    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        { reliable: true }
      );
    } catch (err) {
      logger.error('Failed to send chat message:', err);
      toast.error(wasPersisted ? 'Message saved but not delivered to all participants' : 'Failed to send message');
    }

    addMessage({
      ...payload,
      sentAt: new Date(sentAt),
    });

    setInput('');
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    await publishTyping(false);
  }

  // Poll functions
  function addPollOption() {
    setPollOptions([...pollOptions, '']);
  }

  function removePollOption(index: number) {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  }

  function updatePollOption(index: number, value: string) {
    const updated = [...pollOptions];
    updated[index] = value;
    setPollOptions(updated);
  }

  async function createPoll() {
    if (!localParticipant || !pollQuestion.trim()) return;

    const validOptions = pollOptions.filter(o => o.trim());
    if (validOptions.length < 2) return;

    const pollId = `poll-${Date.now()}`;
    const pollData: PollData = {
      id: pollId,
      question: pollQuestion.trim(),
      options: validOptions.map((text, i) => ({
        id: `${pollId}-option-${i}`,
        text: text.trim(),
        votes: [],
      })),
      allowMultiple,
      createdBy: localParticipant.identity,
      createdByName: localParticipant.name || localParticipant.identity,
      createdAt: new Date(),
      isClosed: false,
    };

    const payload = {
      id: pollId,
      type: 'poll' as const,
      message: pollData.question,
      senderIdentity: localParticipant.identity,
      senderName: localParticipant.name || localParticipant.identity,
      sentAt: new Date().toISOString(),
      poll: pollData,
    };

    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        { reliable: true }
      );
    } catch (err) {
      logger.error('Failed to send poll:', err);
      toast.error('Failed to send poll');
    }

    addMessage({
      ...payload,
      sentAt: new Date(payload.sentAt),
    });

    // Reset poll creator
    setPollQuestion('');
    setPollOptions(['', '']);
    setAllowMultiple(false);
    setShowPollCreator(false);
    chatPanelDraftCache.set(draftKey, {
      input: '',
      sendPrivateToModerators,
      showPollCreator: false,
      pollQuestion: '',
      pollOptions: ['', ''],
      allowMultiple: false,
    });
  }

  async function handleVote(pollId: string, optionId: string) {
    if (!localParticipant) return;

    votePoll(pollId, optionId, localParticipant.identity);

    // Broadcast vote to other participants
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          type: 'poll_vote',
          pollId,
          optionId,
          voterIdentity: localParticipant.identity,
        })),
        { reliable: true }
      );
    } catch (err) {
      logger.error('Failed to send vote:', err);
      toast.error('Failed to send vote');
    }
  }

  async function handleClosePoll(pollId: string) {
    if (!localParticipant) return;

    closePoll(pollId);

    // Broadcast poll close
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          type: 'poll_close',
          pollId,
        })),
        { reliable: true }
      );
    } catch (err) {
      logger.error('Failed to close poll:', err);
      toast.error('Failed to close poll');
    }
  }

  const typingLabel = activeTypers.length === 0
    ? ''
    : activeTypers.length === 1
      ? `${activeTypers[0]} is typing...`
      : `${activeTypers.slice(0, 2).join(', ')} ${activeTypers.length > 2 ? `and ${activeTypers.length - 2} more ` : ''}are typing...`;

  return (
    <div className="w-full md:w-80 flex flex-col bg-surface-800 md:border-l border-surface-700">
      <ChatHeader
        showChatTimestamps={showChatTimestamps}
        onToggleTimestamps={toggleChatTimestamps}
        onCloseChat={toggleChat}
        typingLabel={typingLabel}
      />

      <ChatMessageList
        messages={visibleMessages}
        localParticipant={localParticipant}
        showChatTimestamps={showChatTimestamps}
        onVote={handleVote}
        onClosePoll={handleClosePoll}
        bottomRef={bottomRef}
      />

      {showPollCreator && (
        <Suspense fallback={null}>
          <PollCreator
            visible={showPollCreator}
            pollQuestion={pollQuestion}
            pollOptions={pollOptions}
            allowMultiple={allowMultiple}
            onQuestionChange={setPollQuestion}
            onOptionChange={updatePollOption}
            onAddOption={addPollOption}
            onRemoveOption={removePollOption}
            onAllowMultipleChange={setAllowMultiple}
            onCreatePoll={createPoll}
            onClose={() => setShowPollCreator(false)}
          />
        </Suspense>
      )}

        <ChatInput
          disabled={chatDisabled}
          input={input}
        onInputChange={handleInputChangeWithMentions}
        onKeyDown={handleKeyDown}
        onSendMessage={sendMessage}
        inputRef={inputRef}
        showPrivateToggle={!isModerator && meetingRoomConfig.chat.privateModeratorChatEnabled}
        sendPrivateToModerators={sendPrivateToModerators}
        onTogglePrivate={setSendPrivateToModerators}
        showPollCreator={showPollCreator}
        onTogglePollCreator={() => setShowPollCreator(!showPollCreator)}
        showMentionList={showMentionList}
        filteredParticipants={filteredParticipants}
        selectedMentionIndex={selectedMentionIndex}
        mentionListRef={mentionListRef}
        onSelectMention={selectMention}
        onInsertAtSign={() => {
          setInput((prev) => prev + '@');
          inputRef.current?.focus();
        }}
      />
    </div>
  );
}
