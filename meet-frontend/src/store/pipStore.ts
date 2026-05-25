/**
 * pipStore - Zustand store for Picture-in-Picture preferences
 *
 * Manages user preferences for auto-PiP mode.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AutoPiPMode = 'always' | 'tab-switch' | 'never';

interface PiPState {
  autoPiPMode: AutoPiPMode;
}

interface PiPActions {
  setAutoPiPMode: (mode: AutoPiPMode) => void;
}

export const usePiPStore = create<PiPState & PiPActions>()(
  persist(
    (set) => ({
      autoPiPMode: 'tab-switch' as AutoPiPMode,
      setAutoPiPMode: (mode) => set({ autoPiPMode: mode }),
    }),
    {
      name: 'pip-settings',
    }
  )
);

// Selector hooks
export const useAutoPiPMode = () => usePiPStore((state) => state.autoPiPMode);

// Action hooks
export const usePiPActions = () => usePiPStore((state) => state);

export default usePiPStore;
