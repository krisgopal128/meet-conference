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
  isPiPOpen: boolean;
}

interface PiPActions {
  setAutoPiPMode: (mode: AutoPiPMode) => void;
  setPiPOpen: (open: boolean) => void;
  togglePiP: () => void;
}

export const usePiPStore = create<PiPState & PiPActions>()(
  persist(
    (set) => ({
      autoPiPMode: 'tab-switch' as AutoPiPMode,
      isPiPOpen: false,
      setAutoPiPMode: (mode) => set({ autoPiPMode: mode }),
      setPiPOpen: (open: boolean) => set({ isPiPOpen: open }),
      togglePiP: () => set((state) => ({ isPiPOpen: !state.isPiPOpen })),
    }),
    {
      name: 'pip-settings',
    }
  )
);

// Selector hooks
export const useAutoPiPMode = () => usePiPStore((state) => state.autoPiPMode);
export const useIsPiPOpen = () => usePiPStore((state) => state.isPiPOpen);

// Action hooks
export const usePiPActions = () => usePiPStore((state) => state);

export default usePiPStore;
