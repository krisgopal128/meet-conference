import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Document Picture-in-Picture API hook.
 * Opens a floating always-on-top window that can render arbitrary HTML.
 * Chrome 116+, Edge 116+, Brave, Opera, Arc.
 *
 * Falls back to feature detection only — consumers should check `isSupported`.
 */
export function usePiP() {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pipRef = useRef<Window | null>(null);

  const capability: 'document' | 'video' | 'none' = window.documentPictureInPicture
    ? 'document'
    : document.pictureInPictureEnabled
      ? 'video'
      : 'none';

  const openPiP = useCallback(async () => {
    if (!window.documentPictureInPicture) {
      setError('Document PiP not supported in this browser');
      return;
    }
    try {
      setError(null);
      const win = await window.documentPictureInPicture.requestWindow({
        width: 400,
        height: 400,
      });

      // Clone all stylesheets from main document into PiP document
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
        win.document.head.appendChild(node.cloneNode(true));
      });

      // Set dark background + full height on PiP window to fill entire canvas
      const { documentElement: html, body } = win.document;
      html.style.background = '#0f172a';
      html.style.height = '100%';
      html.style.margin = '0';
      html.style.overflow = 'hidden';
      body.style.background = '#0f172a';
      body.style.height = '100%';
      body.style.margin = '0';
      body.style.overflow = 'hidden';

      pipRef.current = win;
      setPipWindow(win);

      // Detect window close
      win.addEventListener('pagehide', () => {
        pipRef.current = null;
        setPipWindow(null);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open PiP');
    }
  }, []);

  const closePiP = useCallback(() => {
    pipRef.current?.close();
    pipRef.current = null;
    setPipWindow(null);
  }, []);

  const togglePiP = useCallback(() => {
    if (pipRef.current) {
      closePiP();
    } else {
      void openPiP();
    }
  }, [openPiP, closePiP]);

  // Auto-close on unmount
  useEffect(() => {
    return () => {
      pipRef.current?.close();
      pipRef.current = null;
    };
  }, []);

  return {
    pipWindow,
    isSupported: capability === 'document',
    capability,
    error,
    openPiP,
    closePiP,
    togglePiP,
  };
}
