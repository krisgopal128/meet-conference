import type { LocalParticipant } from 'livekit-client';
import logger from '../utils/logger';

const encoder = new TextEncoder();
const CHUNK_SIZE = 12_000;

export function publishMessage(
  participant: LocalParticipant,
  payload: object,
  options?: { reliable?: boolean; topic?: string },
): void {
  const json = JSON.stringify(payload);
  const data = encoder.encode(json);

  const publishOptions = {
    reliable: options?.reliable ?? true,
    ...(options?.topic && { topic: options.topic }),
  };

  if (data.byteLength <= CHUNK_SIZE) {
    participant.publishData(data, publishOptions).catch((e) => {
      logger.warn('[DataChannel] publishData failed', { bytes: data.byteLength, error: e });
    });
    return;
  }

  const chunkId = Math.random().toString(36).slice(2, 10);
  const total = Math.ceil(data.byteLength / CHUNK_SIZE);

  for (let i = 0; i < total; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, data.byteLength);
    const part = data.subarray(start, end);
    const partB64 = btoa(String.fromCharCode(...part));

    const chunkPayload = {
      __chunked: true,
      chunkId,
      index: i,
      total,
      data: partB64,
    };

    const chunkData = encoder.encode(JSON.stringify(chunkPayload));
    participant.publishData(chunkData, publishOptions).catch((e) => {
      logger.warn('[DataChannel] chunk publishData failed', { chunkId, index: i, error: e });
    });
  }
}

export class ChunkReassembler {
  private buffers = new Map<string, Map<number, string>>();

  /** Returns reassembled object if complete, null if still buffering */
  reassemble(parsed: Record<string, unknown>): object | null {
    if (!parsed.__chunked) return parsed as object;

    const chunkId = parsed.chunkId as string;
    const index = parsed.index as number;
    const total = parsed.total as number;
    const data = parsed.data as string;

    let buf = this.buffers.get(chunkId);
    if (!buf) {
      buf = new Map();
      this.buffers.set(chunkId, buf);
    }
    buf.set(index, data);

    if (buf.size < total) return null;

    this.buffers.delete(chunkId);
    const parts: string[] = [];
    for (let i = 0; i < total; i++) {
      parts.push(buf.get(i)!);
    }
    const fullB64 = parts.join('');
    const binary = atob(fullB64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  clear(): void {
    this.buffers.clear();
  }
}
