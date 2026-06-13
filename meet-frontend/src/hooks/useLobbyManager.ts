/**
 * useLobbyManager - Handles lobby status checking and permission handling
 * 
 * Extracted from RoomPage.RoomContent to reduce component complexity.
 */

import { useEffect, useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';

interface UseLobbyManagerProps {
  initialInLobby: boolean;
}

export function useLobbyManager({ initialInLobby }: UseLobbyManagerProps) {
  const { localParticipant } = useLocalParticipant();
  const [inLobby, setInLobby] = useState(initialInLobby);
  const [isConnecting, setIsConnecting] = useState(true);

  const canPublishPerm = localParticipant.permissions?.canPublish;

  useEffect(() => {
    const checkLobbyStatus = () => {
      const permissions = localParticipant.permissions;
      
      if (initialInLobby === true) {
        if (permissions?.canPublish === true) {
          setInLobby(false);
        } else {
          setInLobby(true);
        }
      } else {
        setInLobby(false);
      }
      setIsConnecting(false);
    };

    const timer = setTimeout(checkLobbyStatus, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPublishPerm, initialInLobby]);

  useEffect(() => {
    const handlePermissionChange = () => {
      const permissions = localParticipant.permissions;
      
      if (initialInLobby === true && permissions?.canPublish === true && inLobby) {
        setInLobby(false);
      }
    };

    localParticipant.on('participantPermissionsChanged', handlePermissionChange);
    return () => {
      localParticipant.off('participantPermissionsChanged', handlePermissionChange);
    };
  }, [localParticipant, inLobby, initialInLobby]);

  return { inLobby, isConnecting, setInLobby };
}
