/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_LIVEKIT_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}


// Insertable Streams API (Chrome/Edge) — not yet in TS lib.dom.d.ts
declare var MediaStreamTrackProcessor: {
  prototype: MediaStreamTrackProcessor;
  new (options: { track: MediaStreamTrack; maxBufferSize?: number }): MediaStreamTrackProcessor;
};

interface MediaStreamTrackProcessor {
  readable: ReadableStream<VideoFrame>;
  writable?: WritableStream<VideoFrame>;
}

declare var MediaStreamTrackGenerator: {
  prototype: MediaStreamTrackGenerator;
  new (options: { kind: 'audio' | 'video' }): MediaStreamTrackGenerator;
};

interface MediaStreamTrackGenerator extends MediaStreamTrack {
  writable: WritableStream<VideoFrame>;
}
