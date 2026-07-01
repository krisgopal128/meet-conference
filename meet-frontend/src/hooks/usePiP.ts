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

      // Clone all stylesheets from main document into PiP document.
      // Strip inline event handlers (e.g. onload) — the PiP document inherits
      // the main page CSP (script-src 'self' 'unsafe-eval') which blocks
      // 'unsafe-inline', so inline handlers like onload="this.media='all'"
      // on the font <link> would trigger CSP violations.
      document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel="stylesheet"]').forEach((node) => {
        const clone = node.cloneNode(true) as HTMLElement;
        if (clone.tagName === 'LINK') {
          clone.removeAttribute('onload');
          // The font preload link uses media="print" + onload swap to "all".
          // Without onload, set media to "all" so styles apply immediately.
          if (clone.getAttribute('media') === 'print') {
            clone.setAttribute('media', 'all');
          }
        }
        win.document.head.appendChild(clone);
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
