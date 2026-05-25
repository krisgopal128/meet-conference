import logger from '../utils/logger';
/**
 * PiPWindowManager - Manages the Document Picture-in-Picture window lifecycle
 *
 * Provides a singleton class to manage the PiP window for video conferencing.
 * Handles opening, closing, and state synchronization between main and PiP windows.
 */

export interface PiPOpenOptions {
  /** Initial width of the PiP window (default: 400) */
  width?: number;
  /** Initial height of the PiP window (default: 300) */
  height?: number;
  /** Hide the "back to tab" button in the PiP window (default: false) */
  disallowReturnToOpener?: boolean;
  /** Use default position/size instead of remembering user's last position (default: false) */
  preferInitialWindowPlacement?: boolean;
}

type PiPCallback = () => void;

class PiPWindowManager {
  private pipWindow: Window | null = null;
  private onEnterCallback?: PiPCallback;
  private onExitCallback?: PiPCallback;
  private isOpening = false;

  /**
   * Check if Document Picture-in-Picture is supported
   */
  isSupported(): boolean {
    return 'documentPictureInPicture' in window;
  }

  /**
   * Check if a PiP window is currently open
   */
  isOpen(): boolean {
    return this.pipWindow !== null && !this.pipWindow.closed;
  }

  /**
   * Get the current PiP window instance
   */
  getWindow(): Window | null {
    if (this.pipWindow && !this.pipWindow.closed) {
      return this.pipWindow;
    }
    return null;
  }

  /**
   * Set callbacks for PiP window events
   */
  setCallbacks(onEnter: PiPCallback, onExit: PiPCallback): void {
    this.onEnterCallback = onEnter;
    this.onExitCallback = onExit;
  }

  /**
   * Open a new Picture-in-Picture window
   * Requires a user gesture (click) to work
   */
  async open(options?: PiPOpenOptions): Promise<Window | null> {
    // Check if already open or opening
    if (this.isOpen()) {
      logger.info('[PiPWindowManager] PiP window already open, focusing');
      this.pipWindow?.focus();
      return this.pipWindow;
    }

    if (this.isOpening) {
      logger.info('[PiPWindowManager] Already opening PiP window');
      return null;
    }

    // Check if supported
    if (!this.isSupported()) {
      logger.warn('[PiPWindowManager] Document Picture-in-Picture is not supported');
      return null;
    }

    this.isOpening = true;

    try {
      const pipOptions: Record<string, number | boolean | undefined> = {
        width: options?.width ?? 400,
        height: options?.height ?? 300,
      };

      if (options?.disallowReturnToOpener !== undefined) {
        pipOptions.disallowReturnToOpener = options.disallowReturnToOpener;
      }
      if (options?.preferInitialWindowPlacement !== undefined) {
        pipOptions.preferInitialWindowPlacement = 1; // API expects number
      }

      const docPip = (window as unknown as { documentPictureInPicture?: { requestWindow: (opts: Record<string, number | boolean | undefined>) => Promise<Window> } }).documentPictureInPicture;
      if (!docPip?.requestWindow) {
        logger.warn('[PiPWindowManager] Document Picture-in-Picture is not supported');
        return null;
      }

      // Request PiP window - requires user gesture
      this.pipWindow = await docPip.requestWindow(pipOptions);

      // Set up close handler
      const pipWin = this.pipWindow;
      if (pipWin) {
        pipWin.addEventListener('pagehide', () => {
          this.handleClose();
        });

        // Set up error handler
        pipWin.addEventListener('error', (event: ErrorEvent) => {
          logger.error('[PiPWindowManager] PiP window error:', event.error);
        });
      }

      // Trigger onEnter callback
      this.onEnterCallback?.();

      logger.info('[PiPWindowManager] PiP window opened successfully');
      return this.pipWindow;
    } catch (error) {
      logger.error('[PiPWindowManager] Failed to open PiP window:', error);
      this.pipWindow = null;
      return null;
    } finally {
      this.isOpening = false;
    }
  }

  /**
   * Close the PiP window
   */
  close(): void {
    if (this.pipWindow && !this.pipWindow.closed) {
      this.pipWindow.close();
      this.handleClose();
    }
  }

  /**
   * Handle PiP window close event
   */
  private handleClose(): void {
    if (!this.pipWindow) return; // Guard against double-call
    this.pipWindow = null;
    this.onExitCallback?.();
    logger.info('[PiPWindowManager] PiP window closed');
  }

  /**
   * Focus the opener (main) window
   * Requires user gesture in PiP window
   */
  focusOpener(): void {
    window.focus();
  }

  /**
   * Resize the PiP window
   * Requires user gesture in PiP window
   */
  resize(width: number, height: number): void {
    if (this.pipWindow) {
      this.pipWindow.resizeTo(width, height);
    }
  }

  /**
   * Resize the PiP window relative to current size
   * Requires user gesture in PiP window
   */
  resizeBy(deltaWidth: number, deltaHeight: number): void {
    if (this.pipWindow) {
      this.pipWindow.resizeBy(deltaWidth, deltaHeight);
    }
  }
}

// Export singleton instance
export const pipWindowManager = new PiPWindowManager();

// Export class for testing
export { PiPWindowManager };
