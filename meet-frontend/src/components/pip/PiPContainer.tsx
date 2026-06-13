/**
 * PiPContainer - Main container for Picture-in-Picture window
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { PiPVideoGrid } from './PiPVideoGrid';
import { PiPControls } from './PiPControls';
import { PiPScreenShare } from './PiPScreenShare';
import { useLocalParticipant, useParticipants, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
  useUserIdentity,
  useUserRole,
  useHostId,
  useIsPiPOpen,
  usePiPActions,
  useParticipantsCanShareScreen,
  useParticipantsCanUnmute,
  useParticipantsCanTurnOnCamera,
} from '../../store/roomStore';
import logger from '../../utils/logger';

const PIP_WINDOW_WIDTH = 400;
const PIP_WINDOW_HEIGHT = 300;

function copyStylesToPiPWindow(pipWindow: Window): void {
  Array.from(document.styleSheets).forEach((styleSheet) => {
    try {
      if (styleSheet.href) {
        const link = pipWindow.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = styleSheet.href;
        pipWindow.document.head.appendChild(link);
      } else {
        const style = pipWindow.document.createElement('style');
        Array.from(styleSheet.cssRules).forEach((rule) => {
          style.appendChild(pipWindow.document.createTextNode(rule.cssText));
        });
        pipWindow.document.head.appendChild(style);
      }
    } catch (e) {
      logger.warn('[PiPContainer] Could not copy stylesheet:', e);
    }
  });
}

export function PiPContainer() {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);

  const isPiPOpen = useIsPiPOpen();
  const { setPiPOpen } = usePiPActions();

  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const screenShareTracks = useTracks([Track.Source.ScreenShare, Track.Source.ScreenShareAudio]);

  const identity = useUserIdentity();
  const role = useUserRole();
  const hostId = useHostId();
  const participantsCanShareScreen = useParticipantsCanShareScreen();
  const participantsCanUnmute = useParticipantsCanUnmute();
  const participantsCanTurnOnCamera = useParticipantsCanTurnOnCamera();
  const isModerator = role === 'host' || role === 'cohost' || role === 'moderator' || identity === hostId;

  const openPiPWindow = useCallback(async () => {
    if (!('documentPictureInPicture' in window)) {
      logger.warn('[PiPContainer] Document Picture-in-Picture is not supported');
      return null;
    }

    try {
      const docPip = window.documentPictureInPicture as {
        requestWindow: (options: { width?: number; height?: number; disallowReturnToOpener?: boolean; preferInitialWindowPlacement?: boolean }) => Promise<Window>;
      };

      const newPipWindow = await docPip.requestWindow({
        width: PIP_WINDOW_WIDTH,
        height: PIP_WINDOW_HEIGHT,
      });

      pipWindowRef.current = newPipWindow;

      newPipWindow.document.body.style.margin = '0';
      newPipWindow.document.body.style.padding = '0';
      newPipWindow.document.body.style.backgroundColor = '#1a1a2e';
      newPipWindow.document.body.style.overflow = 'hidden';
      newPipWindow.document.body.style.width = '100%';
      newPipWindow.document.body.style.height = '100%';

      const containerDiv = newPipWindow.document.createElement('div');
      containerDiv.id = 'pip-root';
      containerDiv.style.width = '100%';
      containerDiv.style.height = '100%';
      containerDiv.style.display = 'flex';
      containerDiv.style.flexDirection = 'column';
      newPipWindow.document.body.appendChild(containerDiv);

      copyStylesToPiPWindow(newPipWindow);

      newPipWindow.addEventListener('pagehide', () => {
        setPipWindow(null);
        setContainer(null);
        pipWindowRef.current = null;
        setPiPOpen(false);
      });

      setPipWindow(newPipWindow);
      setContainer(containerDiv);

      return newPipWindow;
    } catch (error) {
      logger.error('[PiPContainer] Failed to open PiP window:', error);
      setPiPOpen(false);
      return null;
    }
  }, [setPiPOpen]);

  const closePiPWindow = useCallback(() => {
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      setPipWindow(null);
      setContainer(null);
      setPiPOpen(false);
    }
  }, [setPiPOpen]);

  useEffect(() => {
    if (isPiPOpen && !pipWindowRef.current) {
      openPiPWindow();
    } else if (!isPiPOpen && pipWindowRef.current) {
      closePiPWindow();
    }
  }, [isPiPOpen, openPiPWindow, closePiPWindow]);

  const screenShareTrack = screenShareTracks.length > 0 ? screenShareTracks[0] : null;

  if (!isPiPOpen || !container || !pipWindow) {
    return null;
  }

  return createPortal(
    <div className="pip-container">
      {screenShareTrack && (
        <PiPScreenShare
          participant={screenShareTrack.participant}
          publication={screenShareTrack.publication}
        />
      )}

      <div className="pip-video-grid">
        <PiPVideoGrid
          participants={participants}
          activeSpeaker={null}
          localParticipant={localParticipant}
          isModerator={isModerator}
        />
      </div>

      <PiPControls
        onReturnToTab={() => setPiPOpen(false)}
        localParticipant={localParticipant}
        isModerator={isModerator}
        participantsCanShareScreen={participantsCanShareScreen}
        participantsCanUnmute={participantsCanUnmute}
        participantsCanTurnOnCamera={participantsCanTurnOnCamera}
      />
    </div>,
    container
  );
}
