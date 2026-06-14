import type { LocalParticipant } from 'livekit-client';

const encoder = new TextEncoder();

export function publishMessage(
  participant: LocalParticipant,
  payload: object,
  options?: { reliable?: boolean; topic?: string },
): void {
  const data = encoder.encode(JSON.stringify(payload));
  participant.publishData(data, {
    reliable: options?.reliable ?? true,
    ...(options?.topic && { topic: options.topic }),
  });
}
