/**
 * useJoinLeaveSounds - Plays audio tones for participant join/leave events
 * 
 * Extracted from ConferenceRoom to reduce component complexity.
 */

import { useEffect } from 'react';
import { RoomEvent, type Room, type Participant } from 'livekit-client';

const JOIN_TONE_HZ = 740;
const LEAVE_TONE_HZ = 520;
const TONE_DURATION_S = 0.12;
const TONE_GAIN = 0.03;

export function useJoinLeaveSounds(room: Room, localParticipant: Participant, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    let sharedContext: AudioContext | null = null;

    const getContext = (): AudioContext => {
      if (!sharedContext || sharedContext.state === 'closed') {
        sharedContext = new AudioContextCtor();
      }
      return sharedContext;
    };

    const playTone = (frequency: number) => {
      const audioContext = getContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gainNode.gain.value = TONE_GAIN;

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + TONE_DURATION_S);
    };

    const handleParticipantConnected = (participant: Participant) => {
      if (participant.identity !== localParticipant.identity) playTone(JOIN_TONE_HZ);
    };

    const handleParticipantDisconnected = (participant: Participant) => {
      if (participant.identity !== localParticipant.identity) playTone(LEAVE_TONE_HZ);
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      if (sharedContext && sharedContext.state !== 'closed') {
        void sharedContext.close();
      }
    };
  }, [room, localParticipant, enabled]);
}
