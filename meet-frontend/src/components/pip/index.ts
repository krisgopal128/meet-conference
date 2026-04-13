/**
 * Picture-in-Picture Components
 *
 * This module provides components for Document Picture-in-Picture functionality.
 *
 * Components:
 * - PiPContainer: Main container that manages the PiP window lifecycle
 * - PiPControls: Control buttons for the PiP window
 * - PiPVideoGrid: Grid of participants with role-based viewing logic
 * - PiPScreenShare: Screen share display component
 *
 * Usage:
 * ```tsx
 * import { PiPContainer } from '@/components/pip';
 *
 * function MyComponent() {
 *   const [isPiPOpen, setIsPiPOpen] = useState(false);
 *
 *   return (
 *     <>
 *       <button onClick={() => setIsPiPOpen(true)}>Open PiP</button>
 *       <PiPContainer isOpen={isPiPOpen} onClose={() => setIsPiPOpen(false)} />
 *     </>
 *   );
 * }
 * ```
 */

export { PiPContainer } from './PiPContainer';
export { PiPControls } from './PiPControls';
export { PiPVideoGrid } from './PiPVideoGrid';
export { PiPScreenShare } from './PiPScreenShare';
