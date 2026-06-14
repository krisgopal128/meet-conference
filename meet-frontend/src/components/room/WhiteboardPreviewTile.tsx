import { useEffect, useRef, useState, useCallback, memo } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

const PREVIEW_PADDING_PX = 6;

interface WhiteboardPreviewTileProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  sourceElement: HTMLElement | null;
  sceneVersion: number;
  width: number;
  height: number;
}

export const WhiteboardPreviewTile = memo(function WhiteboardPreviewTile({
  excalidrawAPI,
  sourceElement,
  sceneVersion,
  width,
  height,
}: WhiteboardPreviewTileProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isEmptyRef = useRef(true);
  const [, forceRender] = useState(0);
  const renderingRef = useRef(false);

  const drawContained = useCallback((ctx: CanvasRenderingContext2D, source: CanvasImageSource, targetWidth: number, targetHeight: number, sourceWidth: number, sourceHeight: number) => {
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const availableWidth = Math.max(1, targetWidth - PREVIEW_PADDING_PX * 2);
    const availableHeight = Math.max(1, targetHeight - PREVIEW_PADDING_PX * 2);
    const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const drawX = (targetWidth - drawWidth) / 2;
    const drawY = (targetHeight - drawHeight) / 2;

    ctx.drawImage(source, drawX, drawY, drawWidth, drawHeight);
  }, []);

  const renderPreview = useCallback(async () => {
    const api = excalidrawAPI;
    if (!api || !canvasRef.current || renderingRef.current) return;

    renderingRef.current = true;
    try {
      const elements = api.getSceneElements();
      if (!elements || elements.length === 0) {
        if (!isEmptyRef.current) {
          isEmptyRef.current = true;
          forceRender(n => n + 1);
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
        }
        return;
      }

      const target = canvasRef.current;
      if (!target) return;
      const ctx = target.getContext('2d');
      if (!ctx) return;

      const renderedCanvas = sourceElement
        ? Array.from(sourceElement.querySelectorAll('canvas'))
            .filter((canvas) => canvas.width > 0 && canvas.height > 0)
            .sort((a, b) => (b.width * b.height) - (a.width * a.height))[0] ?? null
        : null;

      if (renderedCanvas) {
        drawContained(ctx, renderedCanvas, target.width, target.height, renderedCanvas.width, renderedCanvas.height);

        if (isEmptyRef.current) {
          isEmptyRef.current = false;
          forceRender((n) => n + 1);
        }
        return;
      }

      const { exportToCanvas } = await import('@excalidraw/excalidraw');
      const canvas = await exportToCanvas({
        elements: elements as any,
        appState: {
          ...(api.getAppState() as any),
          exportBackground: true,
        } as any,
        files: (api as any).files ?? undefined,
        getDimensions: () => ({ width, height }),
      });

      drawContained(ctx, canvas, target.width, target.height, canvas.width, canvas.height);

      if (isEmptyRef.current) {
        isEmptyRef.current = false;
        forceRender(n => n + 1);
      }
    } catch {
      // exportToCanvas can fail if elements are in flux
    } finally {
      renderingRef.current = false;
    }
  }, [drawContained, excalidrawAPI, sourceElement, width, height]);

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    }
  }, [width, height]);

  // Re-render on scene change (parent already debounced via rAF)
  useEffect(() => {
    if (!excalidrawAPI) return;
    void renderPreview();
  }, [sceneVersion, excalidrawAPI, renderPreview]);

  return (
    <div
      className="w-full h-full rounded-2xl bg-surface-900 relative overflow-hidden flex items-center justify-center"
      title="Whiteboard preview"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          imageRendering: 'auto',
          display: isEmptyRef.current ? 'none' : 'block',
        }}
      />
      {isEmptyRef.current && (
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
      )}
      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1">
        <span className="bg-black/60 backdrop-blur-sm px-1.5 py-0.5 text-[9px] text-white rounded-sm truncate">
          Whiteboard
        </span>
      </div>
    </div>
  );
});
