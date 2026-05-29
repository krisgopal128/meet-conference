/**
 * Whiteboard API bridge — module-level ref for sharing the Excalidraw API
 * between WhiteboardLayout (which owns the canvas) and WhiteboardPreviewTile
 * (which renders a thumbnail in the filmstrip).
 *
 * Since the ExcalidrawImperativeAPI is a mutable object, it shouldn't go
 * into the zustand store. Instead we use a simple module-level ref.
 */

import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

let _api: ExcalidrawImperativeAPI | null = null;

export function setWhiteboardAPI(api: ExcalidrawImperativeAPI | null) {
  _api = api;
}

export function getWhiteboardAPI(): ExcalidrawImperativeAPI | null {
  return _api;
}
