/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_LIVEKIT_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}


// Document Picture-in-Picture API (Chrome 116+)
interface DocumentPictureInPicture {
  requestWindow(options?: {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
    preferInitialWindowPlacement?: number;
  }): Promise<Window>;
  window: Window | null;
}

interface DocumentPictureInPictureWindow extends Window {
  addEventListener(type: 'pagehide', listener: (event: PageTransitionEvent) => void): void;
  addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
}

interface ExtendedWindow extends Window {
  documentPictureInPicture?: DocumentPictureInPicture;
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
