/**
 * usePictureInPicture - Feature detection hook for Picture-in-Picture API
 *
 * Detects browser support for:
 * - Document Picture-in-Picture API (Chrome 116+) - preferred for video conferencing
 * - Legacy Video Picture-in-Picture API (Chrome 70+) - fallback for single video
 */

import { useState, useEffect } from 'react';

export type PiPPermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported';

export interface PiPSupport {
  /** Whether any PiP API is supported */
  isSupported: boolean;
  /** Whether Document PiP is supported (Chrome 116+) */
  isDocumentPiPSupported: boolean;
  /** Whether legacy Video PiP is supported (Chrome 70+) */
  isVideoPiPSupported: boolean;
  /** Current permission state for PiP */
  permission: PiPPermissionState;
}

/**
 * Hook to detect Picture-in-Picture support
 */
export function usePictureInPicture(): PiPSupport {
  const [support, setSupport] = useState<PiPSupport>({
    isSupported: false,
    isDocumentPiPSupported: false,
    isVideoPiPSupported: false,
    permission: 'unsupported',
  });

  useEffect(() => {
    async function detectPiP() {
      // Check for Document PiP API
      const hasDocumentPiP = 'documentPictureInPicture' in window;
      const hasVideoPiP = 'pictureInPictureEnabled' in document;

      // Determine permission state
      let permissionState: PiPPermissionState = 'unsupported';
      if (hasDocumentPiP) {
        try {
          // Query permission state (Chrome 116+)
          const permissionStatus = await navigator.permissions.query({ name: 'picture-in-picture' as PermissionName });
          permissionState = permissionStatus.state as PiPPermissionState;
        } catch {
          // Permission API not supported
          permissionState = 'prompt';
        }
      }

      // Debug logging
      console.log('[usePictureInPicture] Detection:', {
        isSupported: hasDocumentPiP || hasVideoPiP,
        isDocumentPiPSupported: hasDocumentPiP,
        isVideoPiPSupported: hasVideoPiP,
        permission: permissionState,
      });

      setSupport({
        isSupported: hasDocumentPiP || hasVideoPiP,
        isDocumentPiPSupported: hasDocumentPiP,
        isVideoPiPSupported: hasVideoPiP,
        permission: permissionState,
      });
    }
    detectPiP();
  }, []);

  return support;
}

/**
 * Check if Document PiP is supported (without hook)
 */
export function isDocumentPiPSupported(): boolean {
  return 'documentPictureInPicture' in window;
}

/**
 * Check if Video PiP is supported (without hook)
 */
export function isVideoPiPSupported(): boolean {
  return (
    'pictureInPictureEnabled' in document &&
    typeof document.pictureInPictureEnabled === 'boolean' &&
    document.pictureInPictureEnabled
  );
}

export default usePictureInPicture;
