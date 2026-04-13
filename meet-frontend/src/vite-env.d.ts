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
