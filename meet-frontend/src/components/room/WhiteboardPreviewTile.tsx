/**
 * WhiteboardPreviewTile — Live thumbnail of the whiteboard canvas
 *
 * Renders a miniature preview of the Excalidraw canvas using exportToCanvas.
 * Periodically refreshes to show current whiteboard state.
 * Appears in the filmstrip alongside participant video tiles.
 */

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { exportToCanvas } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

interface WhiteboardPreviewTileProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  width: number;
  height: number;
}

const PREVIEW_INTERVAL_MS = 2000; // Refresh every 2s

export const WhiteboardPreviewTile = memo(function WhiteboardPreviewTile({
  excalidrawAPI,
  width,
  height,
}: WhiteboardPreviewTileProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const renderPreview = useCallback(async () => {
    const api = excalidrawAPI;
    if (!api || !canvasRef.current) return;

    const elements = api.getSceneElements();
    if (!elements || elements.length === 0) {
      setIsEmpty(true);
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    setIsEmpty(false);

    try {
      const canvas = await exportToCanvas({
        elements: elements as any,
        appState: {
          exportBackground: true,
          exportWithDarkMode: true,
          viewBackgroundColor: '#1e1e2e',
        } as any,
        files: (api as any).files ?? undefined,
        getDimensions: () => ({ width, height }),
      });

      const target = canvasRef.current;
      if (!target) return;
      const ctx = target.getContext('2d');
      if (!ctx) return;

      // Clear and draw the exported canvas
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.drawImage(canvas, 0, 0, target.width, target.height);
    } catch {
      // exportToCanvas can fail if elements are in flux
    }
  }, [excalidrawAPI, width, height]);

  // Set canvas dimensions
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    }
  }, [width, height]);

  // Periodic refresh
  useEffect(() => {
    if (!excalidrawAPI) return;

    // Initial render
    void renderPreview();

    timerRef.current = setInterval(() => {
      void renderPreview();
    }, PREVIEW_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [excalidrawAPI, renderPreview]);

  return (
    <div
      className="w-full h-full rounded-lg bg-surface-900 relative overflow-hidden flex items-center justify-center"
      title="Whiteboard preview — what participants see"
    >
      {isEmpty ? (
        <div className="flex flex-col items-center gap-1">
          <svg
            className="w-6 h-6 text-surface-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
            />
          </svg>
          <span className="text-[9px] text-surface-500">Whiteboard</span>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover"
          style={{ imageRendering: 'auto' }}
        />
      )}
      {/* Label overlay */}
      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
        <span className="text-[9px] text-white bg-black/60 px-1.5 py-0.5 rounded truncate">
          Whiteboard
        </span>
        {!isEmpty && (
          <span className="flex items-center gap-0.5 text-[8px] text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
        )}
      </div>
    </div>
  );
});
