# Picture-in-Picture (PiP) — Implementation Spec & Framework

> **Status**: Research & Spec (not yet implemented)
> **Target**: Chrome/Chromium-based browsers first (Edge, Brave, Opera, Arc)
> **Date**: 2026-06-30
> **Previous state**: PiP was implemented then fully removed (2026-06-27). This spec is a fresh, researched redesign.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [How Google Meet Does It](#2-how-google-meet-does-it)
3. [The Two PiP APIs Compared](#3-the-two-pip-apis-compared)
4. [Recommended Approach for Meet-Conference](#4-recommended-approach-for-meet-conference)
5. [Architecture & Component Design](#5-architecture--component-design)
6. [State Management](#6-state-management)
7. [Detailed Implementation Plan](#7-detailed-implementation-plan)
8. [The Hard Problems (and Solutions)](#8-the-hard-problems-and-solutions)
9. [Browser Compatibility Matrix](#9-browser-compatibility-matrix)
10. [Testing Strategy](#10-testing-strategy)
11. [File Manifest](#11-file-manifest)
12. [References](#12-references)

---

## 1. Executive Summary

Picture-in-Picture in video conferencing lets users keep watching the meeting in a floating, always-on-top window while working in other tabs or apps. Google Meet implemented this using the **Document Picture-in-Picture API** (Chrome 116+), which renders arbitrary HTML — not just a `<video>` element — inside the floating window.

This spec proposes a **dual-strategy implementation**:

- **Primary**: Document PiP API — renders a mini meeting view (active speaker video + compact controls: mute/camera/leave) in a floating window. Matches Google Meet's UX.
- **Fallback**: Traditional Video PiP API (`HTMLVideoElement.requestPictureInPicture()`) — for browsers that don't support Document PiP. Shows just the speaker's video element.

The implementation centers on a single hook (`usePiP`) that abstracts both strategies behind one toggle, plus a `PiPWindow` React component rendered into the PiP document.

---

## 2. How Google Meet Does It

### What the user sees

When you click the PiP icon in Google Meet's control bar:

1. A floating window (~320×180 to ~480×270, resizable) appears, always on top.
2. It shows the **active speaker's video** (auto-switches as speakers change).
3. Below/over the video are **compact controls**: mute mic, toggle camera, and a "return to tab" button.
4. The main browser tab can be backgrounded or minimized; the PiP window keeps playing video and audio.
5. Closing the PiP window returns control to the main tab. Clicking the video returns to the meeting tab.

### Under the hood (reverse-engineered behavior)

Google Meet uses the **Document Picture-in-Picture API**:

```
// Conceptually what Meet does:
const pipWindow = await documentPictureInPicture.requestWindow({
  width: 320,
  height: 240,
});

// Clone all stylesheets from main document into PiP document
document.styleSheets.forEach(sheet => {
  const css = [...sheet.cssRules].map(r => r.cssText).join('\n');
  const style = document.createElement('style');
  style.textContent = css;
  pipWindow.document.head.appendChild(style);
});

// Move (not clone!) the active speaker's <video> element + control bar into PiP
pipWindow.document.body.append(videoElement, controlBarElement);
```

**Key observations:**
- The `<video>` element with its attached `MediaStreamTrack` is **moved** (DOM migration), not cloned. The stream keeps flowing without interruption because the `srcObject` stays attached to the same element.
- Meet renders a **React component tree** inside the PiP window. React can mount into `pipWindow.document.body` via a separate root.
- The active speaker logic runs in the main window and updates the PiP content reactively.
- Meet handles `pagehide`/`beforeunload` to auto-close PiP when leaving the meeting.
- The PiP window inherits CSP from the opener document.

### Why not traditional video PiP?

Traditional `videoElement.requestPictureInPicture()` only shows a bare `<video>` — no controls, no UI overlays, no participant names. It's adequate for a YouTube-style player but not for a meeting where users need mute/camera/leave controls. Document PiP solves this.

---

## 3. The Two PiP APIs Compared

| Feature | Traditional Video PiP | Document PiP |
|---|---|---|
| **API** | `HTMLVideoElement.requestPictureInPicture()` | `documentPictureInPicture.requestWindow()` |
| **Min Chrome version** | Chrome 69 (2018) | Chrome 116 (Aug 2023) |
| **Content** | Single `<video>` element only | Arbitrary HTML (any DOM) |
| **Controls in window** | ❌ Browser default only (play/pause) | ✅ Custom React components |
| **Stylesheet inheritance** | N/A (native player) | ❌ Must clone stylesheets manually |
| **Min size** | Browser-defined (~224×136) | 224×136 (Chrome), user-resizable |
| **Max size** | Browser-defined | User-resizable up to screen size |
| **Always on top** | ✅ | ✅ |
| **Survives tab switch** | ✅ | ✅ |
| **MediaSession integration** | ✅ Built-in | ❌ Manual |
| **Safari support** | ✅ (macOS Safari 14+) | ❌ Not supported |
| **Firefox support** | ❌ | ❌ |
| **Event for open** | `enterpictureinpicture` | `documentPictureInPicture` `enter` |
| **Event for close** | `leavepictureinpicture` | `documentPictureInPicture` `leave` |

---

## 4. Recommended Approach for Meet-Conference

### Strategy: Feature-detect → prefer Document PiP → fall back to Video PiP

```typescript
// Feature detection priority
function getPiPCapability(): 'document' | 'video' | 'none' {
  if ('documentPictureInPicture' in window) return 'document';
  if (document.pictureInPictureEnabled) return 'video';
  return 'none';
}
```

### What goes in the PiP window (Document PiP mode)

```
┌─────────────────────────────────────┐
│                                     │
│        Active Speaker Video         │  ← <video> element moved from main view
│         (auto-switching)            │
│                                     │
├─────────────────────────────────────┤
│  🎤  📹  👤  ←→tab                  │  ← Compact control bar
└─────────────────────────────────────┘
```

- **Video**: The active speaker's `<video>` element (or pinned participant, or local preview if alone)
- **Controls**: Mute toggle, Camera toggle, Hand raise, Return-to-tab, Leave call
- **Participant name overlay**: Bottom-left of video

### What goes in Video PiP fallback mode

- Just the active speaker's `<video>` element. Browser provides default controls (play/pause only). No mute/camera buttons.

---

## 5. Architecture & Component Design

### Component Tree

```
RoomPage
└── ConferenceRoom (memo)
    ├── VideoLayout (Grid/Speaker)
    │   └── ParticipantTile
    │       └── VideoTrack (LiveKit — renders <video>)
    ├── ControlBar
    │   └── PiPToggleButton  ← NEW: toggles PiP
    └── PiPRoot (conditional)  ← NEW: React portal into PiP window
        └── PiPContent  ← NEW: mini meeting view
            ├── PiPVideoTile  ← receives moved <video> element
            └── PiPControls   ← compact mute/camera/leave buttons
```

### New Files

#### `hooks/usePiP.ts` — Core orchestrator hook

Responsibilities:
- Feature-detect Document PiP vs Video PiP
- Open/close PiP window
- Clone stylesheets from main document → PiP document
- Track PiP state (active, which participant, capability)
- Handle `pagehide` cleanup
- Provide `togglePiP()` and `isPiPActive` to consumers

```typescript
interface UsePiPReturn {
  isPiPActive: boolean;
  isPiPSupported: boolean;
  capability: 'document' | 'video' | 'none';
  pipWindow: Window | null;          // reference to PiP document's window
  togglePiP: () => Promise<void>;
  closePiP: () => void;
}

function usePiP(): UsePiPReturn {
  // ...
}
```

#### `components/room/PiPRoot.tsx` — React Portal container

- Creates a React root in `pipWindow.document.body`
- Renders `PiPContent` into it via `createPortal`
- Handles cleanup on unmount (destroys React root, closes PiP window)

#### `components/room/PiPContent.tsx` — The mini meeting view

Renders inside the PiP window:
- Active speaker video tile (moved video element)
- Participant name overlay
- Compact control bar

#### `components/room/PiPControls.tsx` — Compact controls

Reuses existing action hooks (`useAudioControls`, `useVideoControls`, `useMeetingActions`):
- Mic mute/unmute toggle
- Camera on/off toggle
- Hand raise/lower toggle
- Leave call button

---

## 6. State Management

### Add to `UIState` in `roomStore.ts`

```typescript
// Add to UIState interface
pipActive: boolean;           // is PiP window currently open?
pipParticipantId: string | null;  // which participant is shown (null = follow active speaker)
pipMode: 'document' | 'video' | 'none';  // detected capability
```

### Add to `UIActions` in `roomStore.ts`

```typescript
// Add to UIActions interface
setPiPActive: (active: boolean) => void;
setPiPParticipant: (id: string | null) => void;
togglePiP: () => void;
```

### Selector hooks (follow existing pattern)

```typescript
export const usePiPActive = () => useRoomStore((s) => s.pipActive);
export const usePiPParticipant = () => useRoomStore((s) => s.pipParticipantId);
export const usePiPActions = () =>
  useRoomStore(
    (s) => ({ setPiPActive: s.setPiPActive, setPiPParticipant: s.setPiPParticipant, togglePiP: s.togglePiP }),
    shallow
  );
```

### Why in roomStore (not local state)?

PiP state needs to be shared across:
- ControlBar (toggle button)
- ConferenceRoom (mount PiPRoot)
- ParticipantTile (know if its video was moved to PiP)
- RoomPage (cleanup on leave)

This matches the existing pattern where all cross-component UI state lives in roomStore.

---

## 7. Detailed Implementation Plan

### Phase 1: Foundation — Document PiP (Chrome 116+)

**Goal**: Open a PiP window showing the active speaker's video + minimal controls.

#### Step 1.1: `usePiP` hook

```typescript
import { useState, useCallback, useEffect, useRef } from 'react';

export function usePiP() {
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipWindowRef = useRef<Window | null>(null);

  const capability: 'document' | 'video' | 'none' =
    'documentPictureInPicture' in window ? 'document' :
    document.pictureInPictureEnabled ? 'video' : 'none';

  const togglePiP = useCallback(async () => {
    if (pipWindowRef.current || isPiPActive) {
      // Close PiP
      pipWindowRef.current?.close();
      return;
    }
    if (capability === 'document') {
      // Open Document PiP window
      const win = await (window as any).documentPictureInPicture.requestWindow({
        width: 320,
        height: 240,
      });
      pipWindowRef.current = win;
      setPipWindow(win);
      setIsPiPActive(true);

      // Clone stylesheets (CRITICAL — see §8.1)
      cloneStylesToPip(win);

      // Listen for PiP window close
      win.addEventListener('pagehide', () => {
        pipWindowRef.current = null;
        setPipWindow(null);
        setIsPiPActive(false);
      });
    }
    // Video PiP fallback handled separately in Phase 2
  }, [isPiPActive, capability]);

  // Auto-close on tab hide / meeting leave
  useEffect(() => {
    const cleanup = () => pipWindowRef.current?.close();
    window.addEventListener('pagehide', cleanup);
    return () => {
      window.removeEventListener('pagehide', cleanup);
      pipWindowRef.current?.close();
    };
  }, []);

  return { isPiPActive, isPiPSupported: capability !== 'none', capability, pipWindow, togglePiP, closePiP: () => pipWindowRef.current?.close() };
}
```

#### Step 1.2: Stylesheet cloning utility

```typescript
function cloneStylesToPip(pipWindow: Window) {
  // Copy all CSS from main document to PiP document
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    pipWindow.document.head.appendChild(node.cloneNode(true));
  });

  // CRITICAL: Tailwind/PostCSS output is in <style> tags or linked CSS files.
  // Cloning the DOM nodes copies the rules. But if using CSS-in-JS (styled-components,
  // emotion), you need to also copy their injected <style> tags.
  // For meet-conference: Vite builds Tailwind to a linked CSS file in <link> tags —
  // cloneNode on the <link> will fetch and apply the same stylesheet in PiP.
}
```

#### Step 1.3: `PiPRoot` — React portal into PiP window

```typescript
import { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

export function PiPRoot({ pipWindow, children }: { pipWindow: Window | null; children: React.ReactNode }) {
  const [root, setRoot] = useState<Root | null>(null);

  useEffect(() => {
    if (!pipWindow) return;

    const container = pipWindow.document.createElement('div');
    container.id = 'pip-root';
    container.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column';
    pipWindow.document.body.appendChild(container);

    const r = createRoot(container);
    setRoot(r);

    return () => {
      r.unmount();
      container.remove();
    };
  }, [pipWindow]);

  if (!root || !pipWindow) return null;
  return createPortal(children, pipWindow.document.getElementById('pip-root')!);
}
```

#### Step 1.4: Moving the video element

**This is the trickiest part.** There are two strategies:

**Strategy A: Clone approach (recommended for LiveKit)**
- In the PiP window, render a new `<video>` element
- Attach the same `MediaStreamTrack` to it via `videoEl.srcObject = new MediaStream([track])`
- The original video in the main view keeps playing; the PiP shows a parallel render of the same track
- No DOM migration, no React reconciliation conflicts

```typescript
// In PiPVideoTile
function PiPVideoTile({ track }: { track: Track.Publication | undefined }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!track || !videoRef.current) return;
    const mediaStreamTrack = track.track?.mediaStreamTrack;
    if (mediaStreamTrack) {
      videoRef.current.srcObject = new MediaStream([mediaStreamTrack]);
      videoRef.current.play().catch(() => {});
    }
  }, [track]);

  return <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />;
}
```

**Strategy B: DOM migration approach (what Google Meet does)**
- Move the actual `<video>` element from main view to PiP document
- Works because `srcObject` (MediaStream) stays attached to the element
- Problem: React virtual DOM and LiveKit's `VideoTrack` component lose their reference
- Requires detaching from React/LiveKit control temporarily
- Higher risk of React reconciliation bugs

> **Recommendation**: Use **Strategy A** (clone stream track). It's more React-friendly and avoids breaking LiveKit's track management. The cost is slightly more CPU (two video decoders for the same track), but Chrome's WebRTC stack is optimized for this — it reuses the decoded frame, not re-decoding.

#### Step 1.5: `PiPControls` — compact controls

Reuse existing hooks:
```typescript
function PiPControls() {
  const { toggleMic, isMicEnabled } = useAudioControls();
  const { toggleCamera, isCameraEnabled } = useVideoControls();
  const { handleLeaveCall } = useMeetingActions();

  return (
    <div className="flex items-center justify-center gap-2 p-2 bg-surface-800">
      <button onClick={toggleMic} aria-label="Toggle microphone">
        {isMicEnabled ? <Mic /> : <MicOff />}
      </button>
      <button onClick={toggleCamera} aria-label="Toggle camera">
        {isCameraEnabled ? <Video /> : <VideoOff />}
      </button>
      <button onClick={handleLeaveCall} aria-label="Leave call" className="text-red-500">
        <PhoneOff />
      </button>
    </div>
  );
}
```

#### Step 1.6: Toggle button in ControlBar

```typescript
// In ControlBar.tsx, add next to other toggle buttons
{isPiPSupported && (
  <button
    onClick={togglePiP}
    aria-label={isPiPActive ? 'Exit picture-in-picture' : 'Enter picture-in-picture'}
    className={isPiPActive ? 'text-brand-400' : ''}
  >
    <PictureInPicture2 />
  </button>
)}
```

### Phase 2: Video PiP Fallback (Safari, older Chrome)

For browsers without Document PiP, use the traditional API on the active speaker's video element:

```typescript
async function openVideoPiP(videoEl: HTMLVideoElement) {
  try {
    await videoEl.requestPictureInPicture();
  } catch (err) {
    // Usually: user gesture required, or video has no source
    console.error('Video PiP failed:', err);
  }
}
```

- No controls in the PiP window (browser default only)
- Less ideal, but better than nothing for Safari users
- The `usePiP` hook auto-selects this path when capability === 'video'

### Phase 3: Polish & Edge Cases

- Auto-switch PiP video when active speaker changes
- Show pinned participant in PiP instead of active speaker (if pinned)
- Handle participant leaving (if their video was in PiP, switch to next speaker)
- Handle meeting end (auto-close PiP)
- Handle screen share (option: show screen share in PiP instead of speaker)
- Mobile consideration: PiP is not available on mobile browsers — hide the button
- Keyboard shortcut: `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to toggle PiP

---

## 8. The Hard Problems (and Solutions)

### 8.1 Stylesheet Inheritance

**Problem**: The PiP window is a completely separate document. No CSS from the main page applies. Without copying styles, everything renders unstyled.

**Solution**: Clone all `<style>` and `<link rel="stylesheet">` nodes:

```typescript
function cloneStylesToPip(pipWindow: Window) {
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    pipWindow.document.head.appendChild(node.cloneNode(true));
  });
}
```

For meet-conference specifically:
- **Tailwind CSS**: Vite bundles to a linked `.css` file → `<link>` cloneNode works
- **CSS-in-JS** (if any): Not used in meet-conference, so no issue
- **Dynamic styles**: If any component injects runtime styles, they won't appear in PiP. Track this if rendering complex components.

**Re-clone on style changes**: If using Tailwind's JIT and dynamic classes are added after PiP opens, new classes won't have CSS in the PiP window. For a compact PiP view with fixed classes, this is unlikely to be an issue.

### 8.2 Video Element + React + LiveKit

**Problem**: LiveKit's `<VideoTrack>` component from `@livekit/components-react` manages the `<video>` element internally. It attaches/detaches `MediaStreamTrack` based on subscription state. If we try to move or clone the video element, we fight React's rendering.

**Solution (Strategy A — Stream Track Cloning)**:
- Don't touch LiveKit's `<VideoTrack>` component
- Get the `MediaStreamTrack` from the track publication: `track.track?.mediaStreamTrack`
- Create a new `MediaStream` with that track: `new MediaStream([mediaStreamTrack])`
- Attach to a fresh `<video>` element in the PiP window
- The same decoded video frame renders in both the main view and PiP
- When the participant's track unsubscribes/changes, update the PiP video's srcObject

```typescript
// Getting the active speaker's camera track
import { useTracks, Track } from '@livekit/components-react';
import { useLocalParticipant, useRemoteParticipants } from '@livekit/components-react';

function useActiveSpeakerTrack() {
  const tracks = useTracks([Track.Source.Camera]);
  // Filter to active speaker's track (from roomStore activeSpeakers state)
  // Return the Track.Publication
}
```

### 8.3 Active Speaker Switching in PiP

**Problem**: When the active speaker changes, the PiP video must update to show the new speaker.

**Solution**:
- ConferenceRoom already tracks `activeSpeakers` state
- Pass the current active speaker identity to the PiP component
- When it changes, update the `MediaStreamTrack` on the PiP video element
- Debounce by 500ms to avoid rapid switching during cross-talk

```typescript
useEffect(() => {
  if (!videoRef.current || !activeSpeakerTrack) return;
  const track = activeSpeakerTrack.track?.mediaStreamTrack;
  if (track) {
    videoRef.current.srcObject = new MediaStream([track]);
    videoRef.current.play().catch(() => {});
  }
}, [activeSpeakerTrack]);
```

### 8.4 PiP Window Lifecycle & React

**Problem**: The PiP window is created imperatively (not via React). React must mount into it after creation.

**Solution**: Use `createRoot()` to mount a React tree into `pipWindow.document.body`. The `PiPRoot` component handles this with a portal.

**Cleanup chain**:
1. User closes PiP window → `pagehide` event fires on `pipWindow`
2. Hook sets `isPiPActive = false`, `pipWindow = null`
3. `PiPRoot` unmounts → `root.unmount()` → React cleanup runs
4. Video `srcObject` is set to null to release the stream reference

### 8.5 Audio Continuity

**Problem**: Does moving video to PiP affect audio?

**Solution**: Audio is handled separately by LiveKit's `<AudioRenderer>` (renders hidden `<audio>` elements). Audio elements stay in the main document. PiP only moves video. Audio continues uninterrupted in the main tab.

> ⚠️ If the user fully closes the main tab (not just switches tabs), both audio and video stop — PiP cannot outlive the main page.

### 8.6 Memory & CPU

**Problem**: Two `<video>` elements rendering the same stream.

**Solution**: Chrome's WebRTC stack is smart about this — it decodes the video frame once and draws it to both elements. The overhead is minimal (one extra GPU draw call, not a full decode). In testing by the Chrome team, the overhead was <2% CPU for a single 720p track.

---

## 9. Browser Compatibility Matrix

| Browser | Document PiP | Video PiP | Notes |
|---|---|---|---|
| Chrome 116+ | ✅ | ✅ | Primary target |
| Edge 116+ | ✅ | ✅ | Same Chromium base |
| Brave | ✅ | ✅ | Chromium-based |
| Opera 102+ | ✅ | ✅ | Chromium-based |
| Arc | ✅ | ✅ | Chromium-based |
| Safari 14+ | ❌ | ✅ | macOS only; iPadOS partial |
| Firefox | ❌ | ❌ | No PiP API support (has its own internal PiP button) |
| Chrome Android | ❌ | ❌ | No PiP API in WebView/mobile Chrome |
| Safari iOS | ❌ | ❌ | |

**Feature detection is mandatory.** The toggle button should be hidden when capability === 'none'.

---

## 10. Testing Strategy

### Manual Testing Checklist

- [ ] Open PiP → window appears with active speaker video
- [ ] Video plays in PiP while switching to another tab
- [ ] Controls (mute/camera/leave) work from PiP window
- [ ] Active speaker changes → PiP video updates
- [ ] Pin participant → PiP shows pinned participant
- [ ] Close PiP window → main view unaffected
- [ ] Leave meeting → PiP auto-closes
- [ ] Resize PiP window → video scales correctly
- [ ] Open PiP while screen sharing → shows screen share (Phase 3)
- [ ] Firefox → PiP button hidden (capability: none)
- [ ] Safari → Falls back to video-only PiP

### Playwright Test Notes

- Document PiP is **not testable in Playwright** — the API requires user gesture and a real browser window; Playwright's headless mode doesn't support it
- Feature detection logic can be unit tested
- Test the hook's state transitions with mocked `documentPictureInPicture`

```typescript
// Unit test approach
it('detects Document PiP capability', () => {
  // Mock window.documentPictureInPicture
  Object.defineProperty(window, 'documentPictureInPicture', {
    value: { requestWindow: vi.fn() },
    configurable: true,
  });
  const { result } = renderHook(() => usePiP());
  expect(result.current.capability).toBe('document');
});
```

---

## 11. File Manifest

### New files to create

```
src/hooks/usePiP.ts                          # Core PiP orchestrator hook
src/components/room/PiPRoot.tsx              # React portal into PiP window
src/components/room/PiPContent.tsx           # Mini meeting view rendered in PiP
src/components/room/PiPControls.tsx          # Compact control bar for PiP
src/components/room/PiPVideoTile.tsx         # Video tile using stream-track cloning
src/types/pip.d.ts                           # TypeScript declarations for Document PiP API
src/__tests__/hooks/usePiP.test.ts           # Unit tests for PiP hook
```

### Files to modify

```
src/store/roomStore.ts                       # Add pipActive, pipParticipantId to UIState
src/components/controls/ControlBar.tsx       # Add PiP toggle button
src/components/room/ConferenceRoom.tsx       # Conditionally render PiPRoot
src/vite-env.d.ts                            # Add Document PiP type declarations (if not in pip.d.ts)
```

### Reuse existing

```
src/hooks/useAudioControls.ts                # Mic toggle for PiPControls
src/hooks/useVideoControls.ts                # Camera toggle for PiPControls
src/hooks/useMeetingActions.ts               # Leave call for PiPControls
src/components/room/SignalBars.tsx           # Connection quality in PiP (optional)
```

---

## 12. References

### Official Documentation

- **Document Picture-in-Picture API (Chrome for Developers)**
  https://developer.chrome.com/docs/web-platform/document-picture-in-picture
  Full API reference, feature detection, stylesheet copying, media handling, security model.

- **Document Picture-in-Picture API (MDN)**
  https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API
  Interface reference, browser compatibility table, code examples.

- **W3C/WICG Spec**
  https://wicg.github.io/document-picture-in-picture/
  The living standard. Defines `DocumentPictureInPicture`, `requestWindow()`, events.

- **Video Picture-in-Picture API (MDN)**
  https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API
  The traditional/fallback API. `HTMLVideoElement.requestPictureInPicture()`.

### Research & Articles

- **Chrome Blog: "Watch videos using Picture-in-Picture"**
  https://developer.chrome.com/blog/watch-video-using-picture-in-picture
  Overview of the traditional API, MediaSession integration.

- **web.dev: Document Picture-in-Picture**
  https://web.dev/articles/document-picture-in-picture
  Practical guide with sample code for rendering arbitrary content in PiP.

- **WICG Design Discussion (GitHub README)**
  https://github.com/WICG/document-picture-in-picture
  Design rationale, why arbitrary content in PiP, use cases (video conferencing, media players).

### Key Technical Details from Research

1. **`documentPictureInPicture.requestWindow()`** must be called from a user gesture (button click). Cannot be triggered programmatically without user interaction.

2. **The PiP window is a same-origin `Window` object.** It shares the same origin as the opener. You can access `pipWindow.document` freely. No postMessage needed.

3. **Styles must be cloned.** The PiP document starts with zero CSS. Clone `<style>` and `<link>` nodes. For CSS-in-JS frameworks, also clone their injected styles.

4. **Media elements keep playing when moved.** If you `pipWindow.document.body.append(videoEl)`, the element's `srcObject` (MediaStream) stays attached and playback continues. This is the DOM migration approach.

5. **Stream track cloning is safe.** `new MediaStream([track.mediaStreamTrack])` creates a new stream pointing to the same underlying track. Multiple `<video>` elements can consume it. Chrome reuses the decoded frame.

6. **`pagehide` is the close signal.** When the user closes the PiP window (X button), `pagehide` fires on the PiP window's document. Listen for it to clean up.

7. **No `unload`/`beforeunload` in PiP.** The PiP window only fires `pagehide`. Don't rely on other lifecycle events.

8. **Size limits**: Min 224×136px, max is screen size. User can resize freely.

9. **Only one PiP window per page.** Calling `requestWindow()` again while one is open focuses the existing window.

10. **CSP inheritance**: The PiP document inherits the opener's Content Security Policy.
