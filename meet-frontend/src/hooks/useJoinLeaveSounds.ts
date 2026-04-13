/**
 * useJoinLeaveSounds - Plays audio tones for participant join/leave events
 * 
 * Extracted from ConferenceRoom to reduce component complexity.
 */

import { useEffect } from 'react';
import { RoomEvent, type Room, type Participant } from 'livekit-client';

export function useJoinLeaveSounds(room: Room, localParticipant: Participant, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const playTone = (frequency: number) => {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;

      const audioContext = new AudioContextCtor();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gainNode.gain.value = 0.03;

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.12);

      oscillator.onended = () => { void audioContext.close(); };
    };

    const handleParticipantConnected = (participant: Participant) => {
      if (participant.identity !== localParticipant.identity) playTone(740);
    };

    const handleParticipantDisconnected = (participant: Participant) => {
      if (participant.identity !== localParticipant.identity) playTone(520);
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [room, localParticipant, enabled]);
}
