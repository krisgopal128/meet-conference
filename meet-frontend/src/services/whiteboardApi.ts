import api from './api';

export interface WhiteboardState {
  scene: unknown[];
  locked: boolean;
  updated_at: string | null;
}

export const whiteboardApi = {
  /** Fetch persisted whiteboard scene + lock status */
  async getState(roomName: string): Promise<WhiteboardState> {
    const { data } = await api.get(`/whiteboard/${roomName}`);
    return data;
  },

  /** Save (upsert) whiteboard scene */
  async saveScene(roomName: string, scene: unknown[]): Promise<{ ok: boolean }> {
    const { data } = await api.put(`/whiteboard/${roomName}`, { scene });
    return data;
  },

  /** Toggle lock status (moderator only) */
  async setLocked(roomName: string, locked: boolean): Promise<{ ok: boolean; locked: boolean }> {
    const { data } = await api.patch(`/whiteboard/${roomName}/lock`, { locked });
    return data;
  },

  /** Clear whiteboard scene */
  async clearScene(roomName: string): Promise<{ ok: boolean }> {
    const { data } = await api.delete(`/whiteboard/${roomName}`);
    return data;
  },
};
