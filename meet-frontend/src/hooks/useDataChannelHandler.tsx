/**
 * useDataChannelHandler - Handles all data channel messages
 * 
 * Extracted from ConferenceRoom to reduce component complexity.
 * Handles chat, polls, typing, hand raise, and moderation controls.
 */

import { useEffect, useRef } from 'react';
import { RoomEvent } from 'livekit-client';
import type { Room, LocalParticipant } from 'livekit-client';
import toast from 'react-hot-toast';
import { useChatActions, useFeatureActions, useUIActions, useWhiteboardOpen, useMeetingControlsActions, useHostId } from '../store/roomStore';
import type { ChatMessage } from '../types';

interface UseDataChannelHandlerProps {
  room: Room;
  localParticipant: LocalParticipant;
  isModerator: boolean;
  onMeetingEnded?: (reason: string) => void;
}

export function useDataChannelHandler({ room, localParticipant, isModerator, onMeetingEnded }: UseDataChannelHandlerProps) {
  const { addMessage, setTypingParticipant, votePoll, closePoll, incrementMentionCount } = useChatActions();
  // setRecording is destructured from useFeatureActions below
  const { raiseHand, lowerHand, setRecording } = useFeatureActions();
  const { toggleWhiteboard, setVideoFitMode } = useUIActions();
  const whiteboardOpen = useWhiteboardOpen();
  const whiteboardOpenRef = useRef(whiteboardOpen);
  whiteboardOpenRef.current = whiteboardOpen;
  const {
    setMeetingLocked,
    setLobbyEnabled,
    setParticipantsCanShareScreen,
    setParticipantsCanChat,
    setParticipantsCanUnmute,
    setParticipantsCanTurnOnCamera,
  } = useMeetingControlsActions();
  const hostId = useHostId();

  const getSenderRole = (metadata: string | undefined): string => {
    if (!metadata) return 'attendee';
    try {
      const parsed = JSON.parse(metadata) as { role?: string };
      return parsed.role || 'attendee';
    } catch {
      return 'attendee';
    }
  };

  useEffect(() => {
    const handleData = async (
      data: Uint8Array,
      participant?: { identity: string; name?: string; metadata?: string }
    ) => {
      try {
        const payload = JSON.parse(new TextDecoder().decode(data));
        const senderIdentity = participant?.identity;
        const senderName = participant?.name || senderIdentity;
        const senderRole = getSenderRole(participant?.metadata);
        const isPrivilegedSender = !!senderIdentity && (
          senderIdentity === hostId ||
          senderRole === 'host' ||
          senderRole === 'cohost' ||
          senderRole === 'moderator'
        );

        if (!senderIdentity) {
          return;
        }
        
        // Handle meeting_ended - all participants navigate to ThankYou
        if (payload.type === 'meeting_ended') {
          if (!isPrivilegedSender) return;
          onMeetingEnded?.(payload.reason || 'host_left');
          return;
        }

        // Handle recording state sync from host
        if (payload.type === 'recording_state') {
          if (!isPrivilegedSender) return;
          setRecording(payload.isRecording, payload.egressId);
          return;
        }

        if (payload.type === 'private_chat' && !isModerator && senderIdentity !== localParticipant.identity) {
          return;
        }

        if (payload.type === 'chat' || payload.type === 'private_chat') {
          const message = {
            ...payload,
            senderIdentity,
            senderName,
            sentAt: new Date(payload.sentAt),
          } as ChatMessage;
          addMessage(message);
          
          // Check if current user is mentioned (don't notify for own messages)
          if (senderIdentity !== localParticipant.identity && message.mentions) {
            const localIdentity = localParticipant.identity?.toLowerCase().trim();
            const isMentioned = message.mentions.some(
              (m: string) => m.toLowerCase().trim() === localIdentity
            );
            
            if (isMentioned) {
              incrementMentionCount(1);
              // Show toast notification
              const preview = message.message.length > 50 
                ? message.message.substring(0, 50) + '...' 
                : message.message;
              toast.custom((t) => (
                <div className={`${
                  t.visible ? 'animate-enter' : 'animate-leave'
                } max-w-sm w-full bg-surface-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-surface-700 border-l-4 border-brand-500`}>
                  <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 pt-0.5">
                        <span className="text-brand-400 text-lg">@</span>
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-surface-100">
                          {message.senderName || message.senderIdentity} mentioned you
                        </p>
                        <p className="mt-1 text-sm text-surface-400">
                          {preview}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ), { duration: 4000, position: 'top-right' });
            }
          }
        } else if (payload.type === 'poll') {
          addMessage({ ...payload, senderIdentity, senderName, sentAt: new Date(payload.sentAt) } as ChatMessage);
        } else if (payload.type === 'poll_vote') {
          votePoll(payload.pollId, payload.optionId, senderIdentity);
        } else if (payload.type === 'poll_close') {
          closePoll(payload.pollId);
        } else if (payload.type === 'typing') {
          setTypingParticipant(senderIdentity, senderName || senderIdentity, Boolean(payload.isTyping));
        } else if (payload.type === 'raise_hand') {
          raiseHand(senderIdentity);
        } else if (payload.type === 'lower_hand') {
          lowerHand(senderIdentity);
        } else if (payload.type === 'whiteboard-activate') {
          if (!isPrivilegedSender) return;
          // Sync whiteboard state for all participants except the sender
          // (sender already toggled locally before publishing)
          if (senderIdentity !== localParticipant.identity) {
            if (payload.active !== whiteboardOpenRef.current) {
              toggleWhiteboard();
            }
          }
        } else if (payload.type === 'meeting_settings_update') {
          if (!isPrivilegedSender) return;
          if (senderIdentity !== localParticipant.identity) {
            if (typeof payload.meetingLocked === 'boolean') setMeetingLocked(payload.meetingLocked);
            if (typeof payload.lobbyEnabled === 'boolean') setLobbyEnabled(payload.lobbyEnabled);
            if (typeof payload.participantsCanShareScreen === 'boolean') setParticipantsCanShareScreen(payload.participantsCanShareScreen);
            if (typeof payload.participantsCanChat === 'boolean') setParticipantsCanChat(payload.participantsCanChat);
            if (typeof payload.participantsCanUnmute === 'boolean') setParticipantsCanUnmute(payload.participantsCanUnmute);
            if (typeof payload.participantsCanTurnOnCamera === 'boolean') setParticipantsCanTurnOnCamera(payload.participantsCanTurnOnCamera);
          }
        } else if (payload.type === 'settings_sync') {
          if (!isPrivilegedSender) return;
          if (senderIdentity !== localParticipant.identity && payload.setting === 'videoFitMode' && (payload.value === 'cover' || payload.value === 'contain')) {
            setVideoFitMode(payload.value);
          }
        } else if (payload.type === 'moderation_control' && payload.targetIdentity === localParticipant.identity) {
          if (!isPrivilegedSender) return;
          if (payload.action === 'disable_camera' && localParticipant.isCameraEnabled) {
            await localParticipant.setCameraEnabled(false);
          } else if (payload.action === 'mute_microphone' && localParticipant.isMicrophoneEnabled) {
            await localParticipant.setMicrophoneEnabled(false);
          } else if (payload.action === 'disable_screenshare' && localParticipant.isScreenShareEnabled) {
            await localParticipant.setScreenShareEnabled(false);
          }
        }
      } catch (err) {
        /* Ignore malformed data channel messages, but log for debugging */
        if (import.meta.env.DEV) {
          console.debug('[DataChannel] Malformed message:', err);
        }
      }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, addMessage, raiseHand, lowerHand, setTypingParticipant, isModerator, votePoll, closePoll, localParticipant, toggleWhiteboard, setVideoFitMode, setMeetingLocked, setLobbyEnabled, setParticipantsCanShareScreen, setParticipantsCanChat, setParticipantsCanUnmute, setParticipantsCanTurnOnCamera, setRecording, incrementMentionCount, onMeetingEnded, hostId]);
}
