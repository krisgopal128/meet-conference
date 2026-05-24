# Whiteboard Integration Plan — Meet Conference

> Advisory document for adding an Excalidraw-style collaborative whiteboard to the meeting room.
> Date: 2026-05-21 | Author: Peter (nanobot)

---

## 1. Executive Summary

This document covers how major video conferencing platforms integrate whiteboards, evaluates two approaches for meet-conference, and provides a phased implementation plan using LiveKit data channels for real-time sync.

**Recommendation**: Excalidraw embedded as a side panel (matching existing ChatPanel/ParticipantsPanel pattern), synced via LiveKit `RoomEvent.DataReceived`. Estimated effort: 2–3 sessions.

---

## 2. Competitor Research

### Google Meet
- **Tool**: Jamboard (discontinued 2024) → now FigJam / Google Whiteboard
- **Pattern**: Toolbar button opens whiteboard as **full-screen overlay** over video tiles. Video continues as floating picture-in-picture.
- **Sync**: Firebase Realtime Database (operational transforms). Google accounts required.
- **UX**: Presenter draws, all participants see live. Annotation tools (pen, marker, shapes, sticky notes).

### Zoom
- **Tool**: Zoom Whiteboard (built-in, launched 2022)
- **Pattern**: Toolbar button → **side panel** (narrow) or **full-screen overlay** (expanded). Toggleable.
- **Sync**: Proprietary WebSocket-based sync via Zoom's media servers.
- **UX**: Rich templates, sticky notes, shapes, connectors. Can save as PNG/PDF. Persistent across sessions.

### Microsoft Teams
- **Tool**: Microsoft Whiteboard
- **Pattern**: Share tab → **full-screen overlay** replaces video. Whiteboard channel tab for async.
- **Sync**: WebSocket to Azure Cosmos DB (CRDT backend via Fluid Framework).
- **UX**: Freeform drawing, sticky notes, templates. Integrated with OneDrive for persistence.

### Discord (Voice Channels)
- **Tool**: Whiteboard integration via third-party bots
- **Pattern**: Link-based — opens in new tab, not embedded.
- **Sync**: Third-party service (Miro, Conceptboard).

### Jitsi Meet
- **Tool**: Excalidraw via external API
- **Pattern**: Toolbar button → **side-by-side** view. Excalidraw renders in an iframe.
- **Sync**: Via prosody XMPP MUC messages (JSON patches).
- **Relevance**: Closest open-source analog to our stack.

### Common Pattern Summary

| Platform | UI Mode | Sync Mechanism | Persistence |
|----------|---------|---------------|-------------|
| Google Meet | Full overlay | Firebase RTDB | Google Drive |
| Zoom | Side panel + overlay | Proprietary WS | Zoom Cloud |
| Teams | Full overlay | Fluid Framework | OneDrive |
| Jitsi | Side-by-side | XMPP MUC | None |
| **Meet Conference** | **Side panel (recommended)** | **LiveKit data channels** | **DB (optional)** |

---

## 3. Approach Comparison

### Option A: Embedded Excalidraw (Recommended)

**Library**: `@excalidraw/excalidraw` (React component)

Pros:
- Production-grade, 45k+ GitHub stars, actively maintained
- Rich drawing tools: freehand, shapes, text, arrows, lines
- Built-in zoom, pan, selection, undo/redo
- React component with `onChange`, `initialData`, `onPointerUpdate` props
- Supports dark mode (matches our UI)
- Zero backend needed — state syncs via LiveKit data channels
- MIT licensed

Cons:
- Bundle size: ~2.5MB (lazy-loaded, mitigates impact)
- Limited customization of toolbar
- Excalidraw scene format is verbose (JSON can be 50KB+ for complex drawings)

### Option B: Custom Canvas (tldraw)

**Library**: `tldraw` (open-source, used by LlamaDraw)

Pros:
- Lighter bundle (~500KB)
- More customizable UI
- Simpler API for programmatic shapes

Cons:
- Smaller community (8k stars vs 45k)
- Less polished drawing experience
- More work to match Excalidraw's feature set

### Option C: Custom Canvas (from scratch)

Pros:
- Full control
- Minimal bundle

Cons:
- Massive development effort (months)
- Reinventing the wheel
- Not recommended

**Verdict**: Option A (Excalidraw). Best UX-to-effort ratio, proven in production (used by Notion, Slack huddles, Linear).

---

## 4. Architecture Design

### 4.1 Component Structure

```
ConferenceRoom.tsx
├── Video Layout (GridLayout / SpeakerLayout / ScreenShareLayout)
├── Side Panels (existing)
│   ├── ChatPanel
│   ├── ParticipantsPanel
│   ├── SettingsPanel
│   └── WhiteboardPanel ← NEW
├── ControlBar.tsx
│   └── WhiteboardButton ← NEW
└── RoomAudioRenderer
```

### 4.2 New Files to Create

| File | Purpose |
|------|---------|
| `src/components/panels/WhiteboardPanel.tsx` | Excalidraw wrapper component |
| `src/hooks/useWhiteboardSync.ts` | LiveKit data channel sync hook |
| `src/store/whiteboardStore.ts` | Whiteboard state (Zustand) |

### 4.3 Store Extensions

Add to `roomStore.ts` UIState:

```typescript
// In UIState interface
whiteboardOpen: boolean;

// In UIActions interface
toggleWhiteboard: () => void;

// In initialUIState
whiteboardOpen: false,

// In store implementation
toggleWhiteboard: () => set((state) => ({
  whiteboardOpen: !state.whiteboardOpen,
}), false, 'toggleWhiteboard'),

// New selector
export const useWhiteboardOpen = () => useRoomStore((state) => state.whiteboardOpen);
```

### 4.4 Data Channel Sync Strategy

The app already uses `RoomEvent.DataReceived` in `useDataChannelHandler.tsx` for chat, polls, hand raise, and moderation. Whiteboard sync extends this same mechanism.

**Message Types**:

```typescript
// Scene-level sync (full state, sent periodically or on join)
type WhiteboardSceneSync = {
  type: 'whiteboard_scene';
  scene: ExcalidrawImperativeAPI['getSceneElements']();
  senderIdentity: string;
  senderName: string;
};

// Incremental updates (element-level, sent on every change)
type WhiteboardUpdate = {
  type: 'whiteboard_update';
  elements: ExcalidrawElement[];
  senderIdentity: string;
};

// Cursor position (pointer updates for live collaboration)
type WhiteboardPointer = {
  type: 'whiteboard_pointer';
  pointer: { x: number; y: number };
  senderIdentity: string;
  senderName: string;
};
```

**Sync Flow**:

```
User draws → onChange fires → debounce 100ms
  → room.localParticipant.publishData({
      payload: JSON.stringify({ type: 'whiteboard_update', elements }),
      reliable: true,    // guaranteed delivery
      topic: 'whiteboard' // optional channel segregation
    })
  → Remote participants receive via DataReceived
  → useWhiteboardSync updates Excalidraw scene
```

**Debouncing**: Excalidraw's `onChange` fires on every mouse move. Debounce at 100ms for element updates, 500ms for full scene sync. Cursor positions can be throttled to 50ms.

### 4.5 Conflict Resolution

Excalidraw doesn't have built-in operational transforms. For a meeting room with typically <10 simultaneous drawers:

1. **Last-write-wins** per element — simplest, works well for small groups
2. Each element has a `version` and `versionNonce` — use these to detect conflicts
3. On conflict: highest `versionNonce` wins
4. Periodic full-scene sync (every 5 seconds) from the "whiteboard owner" (first person who opened it, or moderator) ensures convergence

This is the same approach Jitsi Meet uses with Excalidraw and it works well for small groups.

### 4.6 UI Design

**ControlBar Button**:
- Icon: `Pencil` or `PenLine` from lucide-react
- Position: After ScreenShare button, before Hand raise button
- Active state: blue highlight (matching chat button pattern)
- Mobile: Inside MoreMenu

**WhiteboardPanel** (side panel, same width as ChatPanel = `w-80` / 320px):
```
┌─────────────────────────────────────────────────────┐
│ [Video Grid]                    │ [Whiteboard Panel] │
│                                 │ ┌────────────────┐ │
│                                 │ │  Excalidraw     │ │
│                                 │ │  Canvas         │ │
│                                 │ │  (320px wide)   │ │
│                                 │ │                 │ │
│                                 │ └────────────────┘ │
│                                 │ [Toolbar]          │
├─────────────────────────────────┴────────────────────┤
│ [ControlBar: Mic | Cam | Screen | 🖊 Whiteboard |...] │
└──────────────────────────────────────────────────────┘
```

**Full-screen mode** (future enhancement):
- Button in WhiteboardPanel header to expand to full overlay
- Video tiles become floating PiP window
- Press Escape or button to return to panel mode

---

## 5. Implementation Plan

### Phase 1: Basic Whiteboard Panel (Core)

**Effort**: ~2-3 hours | **Files touched**: 5

1. Install dependency:
   ```bash
   cd meet-frontend
   npm install @excalidraw/excalidraw
   ```

2. Add `whiteboardOpen` / `toggleWhiteboard` to `roomStore.ts` UIState slice

3. Create `WhiteboardPanel.tsx`:
   - Import and render `<Excalidraw>` component
   - Dark mode support (`theme="dark"` prop)
   - Initial empty scene
   - `onChange` handler (debounced)
   - `onPointerUpdate` handler (throttled)

4. Add whiteboard button to `ControlBar.tsx`:
   - Import `PenLine` icon from lucide-react
   - Add `WhiteboardButton` following ChatButton pattern
   - Wire to `toggleWhiteboard`

5. Add panel to `ConferenceRoom.tsx`:
   - Lazy import `WhiteboardPanel`
   - Render alongside existing panels: `{whiteboardOpen && <Suspense><WhiteboardPanel /></Suspense>}`

**Result**: Each participant can open a whiteboard and draw independently.

### Phase 2: Real-Time Sync (Collaboration)

**Effort**: ~2-3 hours | **Files touched**: 3

1. Create `useWhiteboardSync.ts` hook:
   - Subscribes to `RoomEvent.DataReceived`
   - Filters for `whiteboard_*` message types
   - Applies remote updates to Excalidraw via `updateScene` API
   - Publishes local changes via `room.localParticipant.publishData()`

2. Extend `useDataChannelHandler.tsx`:
   - Add cases for `whiteboard_scene`, `whiteboard_update`, `whiteboard_pointer`
   - Or: handle whiteboard messages in dedicated hook (preferred for separation)

3. Wire hook into `WhiteboardPanel.tsx`

**Result**: All participants see drawings in real-time.

### Phase 3: Room-Based Persistence (Room Whiteboard)

**Effort**: ~3-5 hours | **Files touched**: 6-8

This is the **room-based whiteboard** feature — whiteboard data is persisted per room so that admins, moderators, and teachers can rejoin and see the same whiteboard content across sessions.

#### 3.1 Database Schema

New table: `whiteboards`

```sql
CREATE TABLE whiteboards (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  scene_data    JSONB NOT NULL DEFAULT '[]',        -- Excalidraw elements array
  app_state     JSONB DEFAULT '{}',                  -- viewport, scroll, zoom
  thumbnail_url TEXT,                                 -- optional PNG snapshot
  version       INTEGER NOT NULL DEFAULT 1,          -- optimistic concurrency
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id)  -- one whiteboard per room
);

-- Index for fast room lookup
CREATE INDEX idx_whiteboards_room_id ON whiteboards(room_id);
```

**Design notes**:
- **One whiteboard per room** (UNIQUE constraint on `room_id`) — keeps it simple
- `scene_data` stores the full Excalidraw elements array as JSONB (queryable, compressible)
- `version` field enables optimistic concurrency — prevents lost updates when multiple people save simultaneously
- `app_state` stores viewport position so rejoiners see the same view
- No `meeting_id` foreign key — whiteboard persists across meetings in the same room

#### 3.2 Backend API Endpoints

New file: `meet-backend/src/routes/whiteboard.ts`

```
app.use('/whiteboard', whiteboardRouter);
```

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/whiteboard/:roomName` | ✅ any participant | Load whiteboard scene for a room |
| `PUT` | `/whiteboard/:roomName` | ✅ any participant | Save/update whiteboard scene |
| `DELETE` | `/whiteboard/:roomName` | ✅ moderator/admin only | Clear whiteboard |

**GET `/whiteboard/:roomName`** — Load whiteboard:
```typescript
// Response (200):
{
  "roomId": "uuid",
  "sceneData": [...elements],
  "appState": { ... },
  "version": 5,
  "updatedAt": "2026-05-21T04:00:00Z",
  "createdBy": "uuid"
}

// Response (404) — no whiteboard yet:
{ "sceneData": [], "appState": {}, "version": 0 }
```

**PUT `/whiteboard/:roomName`** — Save whiteboard:
```typescript
// Request body:
{
  "sceneData": [...elements],
  "appState": { ... },
  "version": 5    // client sends last-known version
}

// Response (200):
{ "version": 6, "updatedAt": "2026-05-21T04:00:00Z" }

// Response (409 Conflict) — version mismatch:
{
  "error": "CONFLICT",
  "message": "Whiteboard was modified by another user",
  "currentVersion": 7,
  "currentSceneData": [...]
}
```

**DELETE `/whiteboard/:roomName`** — Clear (moderator/admin only):
```typescript
// Response (200):
{ "message": "Whiteboard cleared" }
```

#### 3.3 Auto-Save Flow (Frontend)

The whiteboard auto-saves to the backend so any rejoiner (even in a different meeting session) sees the same data.

```
User draws → onChange fires
  → Local: debounce 2 seconds
  → PUT /whiteboard/:roomName { sceneData, version }
  → On success: bump local version
  → On 409 conflict: merge remote scene with local changes, retry
  → On failure: retry with exponential backoff (max 3 attempts)
```

**Why 2-second debounce?** Not every stroke — only after the user pauses. Reduces API calls by ~90% compared to saving on every change.

**On Whiteboard Open**:
```
Component mounts → GET /whiteboard/:roomName
  → If version > 0: load sceneData as initialData for Excalidraw
  → If version === 0: show empty canvas (first time)
```

**On Whiteboard Close / Leave Meeting**:
```
Component unmounts → flush any pending auto-save immediately
  → Ensures last changes are persisted before leaving
```

#### 3.4 Room-Based Scenarios

**Scenario A: Teacher creates whiteboard, students see it live**
```
1. Teacher opens whiteboard → GET /whiteboard/math-class-101 → empty
2. Teacher draws → auto-save to backend + broadcast via data channel
3. Student opens whiteboard → GET /whiteboard/math-class-101 → has data
4. Student also receives real-time updates via data channel
```

**Scenario B: Teacher leaves, comes back next day**
```
1. Teacher joins room "math-class-101"
2. Opens whiteboard → GET /whiteboard/math-class-101
3. Backend returns scene from yesterday (version: 12)
4. Teacher sees last session's drawings, continues where they left off
```

**Scenario C: Admin wants to review room whiteboard**
```
1. Admin joins room (via admin panel or direct URL)
2. Opens whiteboard → same GET endpoint, same data
3. Admin can view but only moderator/admin can clear
```

**Scenario D: Multiple participants drawing simultaneously**
```
1. Real-time sync via data channels (Phase 2) handles live collaboration
2. Auto-save writes to backend with version check
3. If two people auto-save at same time → 409 conflict → merge → retry
4. Live data channel ensures everyone stays in sync between saves
```

#### 3.5 Frontend Store Extension

Add to `roomStore.ts`:

```typescript
// New state
whiteboardVersion: number;       // last saved version from backend
whiteboardDirty: boolean;        // unsaved changes exist

// New actions
setWhiteboardVersion: (version: number) => void;
markWhiteboardDirty: () => void;
markWhiteboardSaved: () => void;
```

New API module: `src/services/whiteboardApi.ts`:

```typescript
export const whiteboardApi = {
  load: (roomName: string) => 
    api.get(`/whiteboard/${roomName}`),
  
  save: (roomName: string, data: { sceneData: any[]; appState: any; version: number }) =>
    api.put(`/whiteboard/${roomName}`, data),
  
  clear: (roomName: string) =>
    api.delete(`/whiteboard/${roomName}`),
};
```

#### 3.6 Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `meet-backend/migrations/xxx_whiteboards.sql` | **Create** | Database migration |
| `meet-backend/src/routes/whiteboard.ts` | **Create** | API endpoints |
| `meet-backend/src/index.ts` | **Modify** | Register `app.use('/whiteboard', whiteboardRouter)` |
| `meet-frontend/src/services/whiteboardApi.ts` | **Create** | API client |
| `meet-frontend/src/hooks/useWhiteboardAutoSave.ts` | **Create** | Auto-save hook (debounced PUT) |
| `meet-frontend/src/store/roomStore.ts` | **Modify** | Add whiteboard version/dirty state |
| `meet-frontend/src/components/panels/WhiteboardPanel.tsx` | **Modify** | Load on mount, save on unmount |
| `meet-frontend/src/components/panels/WhiteboardToolbar.tsx` | **Create** | Clear button (moderator only), save indicator |

#### 3.7 UX Details

- **Save indicator**: Small dot in whiteboard header — green "Saved", yellow "Saving...", red "Save failed"
- **Clear button**: Only visible to moderator/admin. Shows confirmation dialog. Resets both canvas and backend.
- **Loading state**: Show skeleton/spinner while fetching initial scene from backend
- **First-time prompt**: If `version === 0`, show subtle hint "Start drawing — your whiteboard will be saved for this room"

---

### Phase 4: Collaboration Polish

**Effort**: ~2-3 hours | **Files touched**: 3-4

1. **Cursor awareness**: Show other participants' cursors on whiteboard
   - Use `onPointerUpdate` + `collaborators` prop
   - Display name labels on cursors

2. **Export**: Button to download whiteboard as PNG/SVG
   - Use Excalidraw's `exportToBlob` / `exportToSvg` APIs

3. **Full-screen mode**: Expand whiteboard to overlay
   - New state: `whiteboardFullscreen: boolean`
   - Video tiles move to floating PiP

4. **Thumbnail generation**: Auto-generate PNG thumbnail on save
   - Backend stores small preview image
   - Admin panel can show whiteboard previews per room

### Phase 5: Advanced Features (Future)

- Templates (pre-built shapes, flowcharts)
- Sticky notes
- Laser pointer mode (annotations overlay on screen share)
- Whiteboard version history (browse previous versions, undo across sessions)
- Multi-page whiteboards (tabs within a room)
- External API support (tuition notebook can fetch whiteboard state)

---

## 6. Technical Considerations

### Bundle Size Impact
- `@excalidraw/excalidraw`: ~2.5MB gzipped
- **Mitigation**: Already using `lazy()` import pattern — whiteboard only loads when opened
- No impact on initial page load time

### Data Channel Bandwidth
- LiveKit data channels: max ~1KB per message (unreliable), ~64KB (reliable)
- Excalidraw elements: ~100 bytes each → ~100 elements = 10KB
- **Strategy**: Use `reliable: true` for element updates. Split large scenes into chunks if needed.
- Full scene sync: only when new participant joins whiteboard

### Mobile Considerations
- Side panel width (`w-80` = 320px) is tight for drawing
- **Mobile UX**: On screens <768px, whiteboard should take full width (modal overlay)
- Touch drawing works natively with Excalidraw
- Consider disabling whiteboard button on very small screens (<400px)

### Memory Management
- Excalidraw keeps full scene in memory
- For very long meetings with heavy drawing: scene can grow large
- **Mitigation**: Periodic scene pruning (remove deleted elements) using `refresh` API

---

## 7. Excalidraw API Quick Reference

### Key Props

| Prop | Type | Purpose |
|------|------|---------|
| `onChange` | `(elements, state) => void` | Fires on every change (debounce this) |
| `initialData` | `{ elements, appState }` | Initial scene content |
| `onPointerUpdate` | `(payload) => void` | Cursor/pointer position updates |
| `theme` | `"light" \| "dark"` | UI theme |
| `collaborators` | `Map<string, Collaborator>` | Show remote cursors |
| `UIOptions` | object | Control which tools are visible |
| `langCode` | string | UI language |

### Key Imperative API Methods

```typescript
const excalidrawAPI = useRef<ExcalidrawImperativeAPI>(null);

// Update scene with remote elements
excalidrawAPI.current?.updateScene({
  elements: remoteElements,
  appState: { ... },
});

// Get current scene for sync
const elements = excalidrawAPI.current?.getSceneElements();

// Export as image
const blob = await exportToBlob({ elements, appState, files });
```

### Integration Pattern

```tsx
import { Excalidraw } from "@excalidraw/excalidraw";
import { exportToBlob } from "@excalidraw/utils";

function WhiteboardPanel() {
  const excalidrawRef = useRef<ExcalidrawImperativeAPI>(null);
  
  return (
    <div className="w-80 h-full border-l border-surface-700">
      <Excalidraw
        ref={excalidrawRef}
        theme="dark"
        onChange={debouncedOnChange}
        onPointerUpdate={throttledPointerUpdate}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
      />
    </div>
  );
}
```

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Large scene exceeds data channel limit | Medium | High | Split into chunks; limit element count |
| Concurrent editing conflicts | Low | Low | Last-write-wins with version tracking |
| Excalidraw bundle slows initial load | Low | None | Lazy-loaded, zero impact until opened |
| Mobile drawing UX poor on small panels | Medium | Medium | Full-screen overlay on mobile |
| Excalidraw breaking changes | Low | Medium | Pin version, test before upgrades |

---

## 9. Dependencies

| Package | Version | Size | Purpose |
|---------|---------|------|---------|
| `@excalidraw/excalidraw` | latest | ~2.5MB (gzipped) | Whiteboard component |
| `@excalidraw/utils` | latest | ~50KB | Export utilities |

No backend dependencies needed for Phase 1-2. Phase 3 (persistence) adds one table and two endpoints.

---

## 10. Summary

The whiteboard feature fits naturally into meet-conference's existing architecture:
- **Side panel pattern** matches ChatPanel/ParticipantsPanel/SettingsPanel
- **LiveKit data channels** already handle chat, polls, and moderation
- **Zustand store** already manages panel open/close state
- **Lazy loading** keeps bundle impact at zero until used

**Recommended start**: Phase 1 (standalone panel) → Phase 2 (real-time sync) → Phase 3 (room-based persistence). Phases 1-3 are the core feature. Phases 4-5 are polish and advanced features.

The room-based persistence (Phase 3) is key for the teacher/moderator use case — they can leave and rejoin the same room later, and the whiteboard content is still there.
