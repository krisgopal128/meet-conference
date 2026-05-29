# Meet Conference — Complete File Dependency Tree

_N-ary tree showing all import relationships from entry points to leaf files._
_Each node's children = files it imports. ★ = leaf (no deps). ↻ = already shown above._

---

## Project Structure

```
meet-conference/
├── meet-frontend/src/     # React + TypeScript SPA
│   ├── main.tsx              🚀 Entry point
│   ├── router.tsx            🔀 Route tree (lazy-loaded pages)
│   ├── pages/                📄 24 page components
│   ├── components/           🧩 59 UI components
│   ├── hooks/                🪝 32 custom hooks
│   ├── services/             🔌 5 API services
│   ├── store/                📦 3 Zustand stores
│   ├── types/                🔤 4 type definition files
│   ├── utils/                🔧 8 utility modules
│   ├── config/               ⚙️ 1 config
│   └── contexts/             🔄 1 React context
│
└── meet-backend/src/      # Node.js + Express API
    ├── index.ts               🚀 Entry point (Express setup)
    ├── config.ts              ⚙️ Environment config
    ├── routes/                🛤️ 21 API route modules
    ├── services/              🔌 9 business logic services
    ├── middleware/            🛡️ 6 Express middleware
    ├── schemas/               📋 1 validation schema
    └── utils/                 🔧 2 utilities
```

## Statistics

### Frontend

- **139** files, **365** internal imports
- **21** orphans (no importers, not reachable from entry)
- Avg **2.6** imports/file

  component: 59 · hook: 32 · page: 24 · util: 8 · service: 5 · type: 4 · store: 3 · entry: 1 · router: 1 · context: 1 · config: 1

### Backend

- **41** files, **166** internal imports
- **2** orphans (no importers, not reachable from entry)
- Avg **4.0** imports/file

  route: 21 · service: 9 · middleware: 6 · util: 2 · config: 1 · entry: 1 · schema: 1

---

## Frontend — Deep N-ary Dependency Tree (All Levels)

_Full recursive expansion from entry point to leaf nodes._

```
🚀 main.tsx (entry) ── 1 deps
└── 🔀 router.tsx (router) ── 26 deps
└── ├── 🧩 components/Layout.tsx (component) ── 2 deps
└── ├── ├── 📦 store/authStore.ts (store) ── 4 deps
└── ├── ├── ├── 🔤 types/index.ts (type) ── 3 deps
└── ├── ├── ├── ├── 🔤 types/participant.ts (type) ★ leaf
└── ├── ├── ├── ├── 🔤 types/room.ts (type) ★ leaf
└── ├── ├── ├── └── 🔤 types/api.ts (type) ── 1 deps
└── ├── ├── ├── └── └── 🔤 types/index.ts (type) ↻
└── ├── ├── ├── 🔧 utils/security.ts (util) ★ leaf
└── ├── ├── ├── 🔧 utils/logger.ts (util) ★ leaf
└── ├── ├── └── 🔌 services/api.ts (service) ── 4 deps
└── ├── ├── └── ├── 🔤 types/api.ts (type) ↻
└── ├── ├── └── ├── 🔤 types/index.ts (type) ↻
└── ├── ├── └── ├── 🔧 utils/security.ts (util) ↻
└── ├── ├── └── └── 📦 store/authStore.ts (store) ↻
└── ├── └── 🪝 hooks/useTokenRefresh.ts (hook) ── 4 deps
└── ├── └── ├── 📦 store/authStore.ts (store) ↻
└── ├── └── ├── 🔌 services/api.ts (service) ↻
└── ├── └── ├── 🔧 utils/security.ts (util) ↻
└── ├── └── └── 🔧 utils/logger.ts (util) ↻
└── ├── 🧩 components/ProtectedRoute.tsx (component) ── 1 deps
└── ├── └── 📦 store/authStore.ts (store) ↻
└── ├── 📄 pages/HomePage.tsx (page) ── 9 deps
└── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── 📦 store/authStore.ts (store) ↻
└── ├── ├── 🧩 components/shared/PageErrorBoundary.tsx (component) ── 1 deps
└── ├── ├── └── 🧩 components/ErrorBoundary.tsx (component) ── 1 deps
└── ├── ├── └── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── 🧩 components/shared/Skeletons.tsx (component) ── 1 deps
└── ├── ├── └── 🔧 utils/cn.ts (util) ★ leaf
└── ├── ├── 🧩 components/shared/DashboardStats.tsx (component) ── 2 deps
└── ├── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── ├── └── 🧩 components/shared/Skeletons.tsx (component) ↻
└── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── ├── 🔧 utils/roomName.ts (util) ★ leaf
└── ├── ├── 🔤 types/index.ts (type) ↻
└── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── 📄 pages/RoomPage.tsx (page) ── 8 deps
└── ├── ├── 🧩 components/room/ConferenceRoom.tsx (component) ── 19 deps
└── ├── ├── ├── 📦 store/roomStore.ts (store) ── 2 deps
└── ├── ├── ├── ├── 🔤 types/index.ts (type) ↻
└── ├── ├── ├── └── ⚙️ config/meetingRoomConfig.ts (config) ── 1 deps
└── ├── ├── ├── └── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── 🔧 utils/blurProcessorManager.ts (util) ── 1 deps
└── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── 🧩 components/controls/ControlBar.tsx (component) ── 11 deps
└── ├── ├── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── ├── ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── ├── ├── ├── 🪝 hooks/usePictureInPicture.ts (hook) ── 1 deps
└── ├── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── ├── 🪝 hooks/useAudioControls.ts (hook) ── 3 deps
└── ├── ├── ├── ├── ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── ├── 🪝 hooks/useVideoControls.ts (hook) ── 3 deps
└── ├── ├── ├── ├── ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── ├── 🪝 hooks/useScreenShareControls.ts (hook) ── 2 deps
└── ├── ├── ├── ├── ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── ├── 🪝 hooks/useMeetingActions.ts (hook) ── 3 deps
└── ├── ├── ├── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── ├── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── ├── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── └── 🧩 components/controls/ControlBarButtons.tsx (component) ── 1 deps
└── ├── ├── ├── └── └── 🔧 utils/cn.ts (util) ↻
└── ├── ├── ├── 🧩 components/controls/QualityIndicator.tsx (component) ── 4 deps
└── ├── ├── ├── ├── 🪝 hooks/useAdaptiveQuality.ts (hook) ── 2 deps
└── ├── ├── ├── ├── ├── 🪝 hooks/useNetworkQuality.ts (hook) ── 1 deps
└── ├── ├── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── ├── └── 🪝 hooks/useCallSizeConfig.ts (hook) ── 1 deps
└── ├── ├── ├── ├── └── └── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── ├── 🪝 hooks/useNetworkQuality.ts (hook) ↻
└── ├── ├── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── 🧩 components/room/SpeakerLayout.tsx (component) ── 3 deps
└── ├── ├── ├── ├── 🧩 components/room/ParticipantTile.tsx (component) ── 4 deps
└── ├── ├── ├── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── ├── ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── ├── ├── 🔄 contexts/ParticipantVisibilityContext.tsx (context) ── 4 deps
└── ├── ├── ├── ├── ├── ├── 🪝 hooks/useVisibleParticipants.ts (hook) ★ leaf
└── ├── ├── ├── ├── ├── ├── 🪝 hooks/useTabVisibility.ts (hook) ★ leaf
└── ├── ├── ├── ├── ├── ├── 🪝 hooks/useVideoPool.ts (hook) ── 1 deps
└── ├── ├── ├── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── ├── ├── └── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── └── 🪝 hooks/useAdmittedParticipants.ts (hook) ── 1 deps
└── ├── ├── ├── └── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── 🧩 components/room/GridLayout.tsx (component) ── 3 deps
└── ├── ├── ├── ├── 🧩 components/room/ParticipantTile.tsx (component) ↻
└── ├── ├── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── └── 🪝 hooks/useAdmittedParticipants.ts (hook) ↻
└── ├── ├── ├── 🧩 components/room/ScreenShareLayout.tsx (component) ── 1 deps
└── ├── ├── ├── └── 🧩 components/room/ParticipantTile.tsx (component) ↻
└── ├── ├── ├── 🔄 contexts/ParticipantVisibilityContext.tsx (context) ↻
└── ├── ├── ├── 🪝 hooks/useDataChannelHandler.tsx (hook) ── 2 deps
└── ├── ├── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── └── 🔤 types/index.ts (type) ↻
└── ├── ├── ├── 🪝 hooks/useJoinLeaveSounds.ts (hook) ★ leaf
└── ├── ├── ├── 🪝 hooks/useQualityMonitoring.ts (hook) ── 2 deps
└── ├── ├── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── └── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── 🔤 types/index.ts (type) ↻
└── ├── ├── ├── 🧩 components/panels/ChatPanel.tsx (component) ── 10 deps
└── ├── ├── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── ├── ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── ├── 🔤 types/index.ts (type) ↻
└── ├── ├── ├── ├── 🧩 components/chat/ChatHeader.tsx (component) ── 1 deps
└── ├── ├── ├── ├── └── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── ├── 🧩 components/chat/ChatMessageList.tsx (component) ── 4 deps
└── ├── ├── ├── ├── ├── 🔤 types/index.ts (type) ↻
└── ├── ├── ├── ├── ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── ├── ├── ├── └── 🧩 components/chat/chatUtils.tsx (component) ── 1 deps
└── ├── ├── ├── ├── └── └── 🔧 utils/security.ts (util) ↻
└── ├── ├── ├── ├── 🧩 components/chat/ChatInput.tsx (component) ── 2 deps
└── ├── ├── ├── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── ├── ├── ├── └── 🧩 components/chat/chatUtils.tsx (component) ↻
└── ├── ├── ├── ├── 🧩 components/chat/chatUtils.tsx (component) ↻
└── ├── ├── ├── ├── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── └── 🧩 components/chat/PollCreator.tsx (component) ★ leaf
└── ├── ├── ├── 🧩 components/panels/ParticipantsPanel.tsx (component) ── 7 deps
└── ├── ├── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── ├── ├── 🔤 types/api.ts (type) ↻
└── ├── ├── ├── ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── ├── 🧩 components/panels/ParticipantListItem.tsx (component) ── 1 deps
└── ├── ├── ├── ├── └── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── ├── 🪝 hooks/useParticipantActions.ts (hook) ── 2 deps
└── ├── ├── ├── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── 🧩 components/panels/SettingsPanel.tsx (component) ── 4 deps
└── ├── ├── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── 🧩 components/room/WhiteboardLayout.tsx (component) ── 8 deps
└── ├── ├── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── ├── 🪝 hooks/useWhiteboardSync.ts (hook) ── 2 deps
└── ├── ├── ├── ├── ├── 🔌 services/whiteboardApi.ts (service) ── 1 deps
└── ├── ├── ├── ├── ├── └── 🔌 services/api.ts (service) ↻
└── ├── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── ├── 🪝 hooks/useWhiteboardAutoSave.ts (hook) ── 3 deps
└── ├── ├── ├── ├── ├── 🔌 services/whiteboardApi.ts (service) ↻
└── ├── ├── ├── ├── ├── 🪝 hooks/useMeetingActions.ts (hook) ↻
└── ├── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── ├── 🔌 services/whiteboardApi.ts (service) ↻
└── ├── ├── ├── ├── 🧩 components/room/ParticipantTile.tsx (component) ↻
└── ├── ├── ├── ├── 🧩 components/room/FloatingParticipantPanel.tsx (component) ── 1 deps
└── ├── ├── ├── ├── └── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── ├── 🪝 hooks/useAdmittedParticipants.ts (hook) ↻
└── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── └── 🧩 components/pip/PiPContainer.tsx (component) ── 5 deps
└── ├── ├── └── ├── 🧩 components/pip/PiPVideoGrid.tsx (component) ── 1 deps
└── ├── ├── └── ├── └── 📦 store/roomStore.ts (store) ↻
└── ├── ├── └── ├── 🧩 components/pip/PiPControls.tsx (component) ── 2 deps
└── ├── ├── └── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── ├── └── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── └── ├── 🧩 components/pip/PiPScreenShare.tsx (component) ★ leaf
└── ├── ├── └── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── └── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── 🧩 components/ErrorBoundary.tsx (component) ↻
└── ├── ├── 🧩 components/room/LobbyWaiting.tsx (component) ── 1 deps
└── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── 🔧 utils/blurProcessorManager.ts (util) ↻
└── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── 📄 pages/PreJoinPage.tsx (page) ── 9 deps
└── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── 🪝 hooks/useLightweightVideoFilter.ts (hook) ── 1 deps
└── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── 🪝 hooks/usePreJoinMedia.ts (hook) ── 6 deps
└── ├── ├── ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── ├── 🔧 utils/cameraCapabilities.ts (util) ── 1 deps
└── ├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ├── 🔧 utils/blurProcessorManager.ts (util) ↻
└── ├── ├── ├── 📦 store/roomStore.ts (store) ↻
└── ├── ├── ├── 🔧 utils/logger.ts (util) ↻
└── ├── ├── └── 🧩 components/prejoin/index.ts (component) ── 5 deps
└── ├── ├── └── ├── 🧩 components/prejoin/DeviceSettings.tsx (component) ── 1 deps
└── ├── ├── └── ├── └── 🧩 components/prejoin/types.ts (component) ── 1 deps
└── ├── ├── └── ├── └── └── 📦 store/roomStore.ts (store) ↻
└── ├── ├── └── ├── 🧩 components/prejoin/AudioSettings.tsx (component) ── 1 deps
└── ├── ├── └── ├── └── 🧩 components/prejoin/types.ts (component) ↻
└── ├── ├── └── ├── 🧩 components/prejoin/VideoSettings.tsx (component) ── 2 deps
└── ├── ├── └── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── ├── └── ├── └── 🧩 components/prejoin/types.ts (component) ↻
└── ├── ├── └── ├── 🧩 components/prejoin/PreJoinControls.tsx (component) ── 2 deps
└── ├── ├── └── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── ├── └── ├── └── 🧩 components/prejoin/types.ts (component) ↻
└── ├── ├── └── └── 🧩 components/prejoin/types.ts (component) ↻
└── ├── ├── 🪝 hooks/usePreJoinAuth.ts (hook) ── 4 deps
└── ├── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── ├── 📦 store/authStore.ts (store) ↻
└── ├── ├── ├── 🔤 types/index.ts (type) ↻
└── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
└── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── ├── 🔧 utils/roomName.ts (util) ↻
└── ├── ├── 🔧 utils/security.ts (util) ↻
└── ├── └── 🧩 components/prejoin/index.ts (component) ↻
└── ├── 📄 pages/LoginPage.tsx (page) ── 4 deps
└── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── 📦 store/authStore.ts (store) ↻
└── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── └── 🪝 hooks/useFormValidation.ts (hook) ★ leaf
└── ├── 📄 pages/RegisterPage.tsx (page) ── 4 deps
└── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── 📦 store/authStore.ts (store) ↻
└── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── └── 🪝 hooks/useFormValidation.ts (hook) ↻
└── ├── 📄 pages/ForgotPasswordPage.tsx (page) ── 3 deps
└── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── └── 🪝 hooks/useFormValidation.ts (hook) ↻
└── ├── 📄 pages/ResetPasswordPage.tsx (page) ── 2 deps
└── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── └── 🔧 utils/cn.ts (util) ↻
└── ├── 📄 pages/SchedulePage.tsx (page) ── 7 deps
└── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── 🧩 components/shared/PageErrorBoundary.tsx (component) ↻
└── ├── ├── 🧩 components/schedule/MeetingFormModal.tsx (component) ── 2 deps
└── ├── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── ├── └── 🔤 types/index.ts (type) ↻
└── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── ├── 🔧 utils/timezone.ts (util) ★ leaf
└── ├── ├── 🔤 types/index.ts (type) ↻
└── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── 📄 pages/HistoryPage.tsx (page) ── 7 deps
└── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── 🧩 components/shared/PageErrorBoundary.tsx (component) ↻
└── ├── ├── 🧩 components/shared/Skeletons.tsx (component) ↻
└── ├── ├── 🔤 types/index.ts (type) ↻
└── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── ├── 🔧 utils/security.ts (util) ↻
└── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── 📄 pages/RecordingsPage.tsx (page) ── 1 deps
└── ├── └── 🔌 services/api.ts (service) ↻
└── ├── 📄 pages/MeetingDetailPage.tsx (page) ── 7 deps
└── ├── ├── 🔌 services/api.ts (service) ↻
└── ├── ├── 🧩 components/shared/PageErrorBoundary.tsx (component) ↻
└── ├── ├── 🧩 components/shared/Skeletons.tsx (component) ↻
└── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── ├── 🔧 utils/security.ts (util) ↻
└── ├── ├── 🔤 types/index.ts (type) ↻
└── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── 📄 pages/NotFoundPage.tsx (page) ★ leaf
└── ├── 📄 pages/ThankYouPage.tsx (page) ── 1 deps
└── ├── └── 📦 store/authStore.ts (store) ↻
└── ├── 📄 pages/ApiKeysPage.tsx (page) ── 2 deps
└── ├── ├── 📦 store/authStore.ts (store) ↻
└── ├── └── 🧩 components/settings/ApiKeyManager.tsx (component) ── 3 deps
└── ├── └── ├── 🔌 services/apiKeysApi.ts (service) ── 1 deps
└── ├── └── ├── └── 🔌 services/api.ts (service) ↻
└── ├── └── ├── 📦 store/authStore.ts (store) ↻
└── ├── └── └── 🔧 utils/logger.ts (util) ↻
└── ├── 📄 pages/prashasakah/PrashasakahLayout.tsx (page) ── 1 deps
└── ├── └── 📦 store/authStore.ts (store) ↻
└── ├── 📄 pages/prashasakah/Dashboard.tsx (page) ── 7 deps
└── ├── ├── 📦 store/authStore.ts (store) ↻
└── ├── ├── 🔌 services/prashasakahApi.ts (service) ── 1 deps
└── ├── ├── └── 🔌 services/api.ts (service) ↻
└── ├── ├── 🧩 components/prashasakah/StatCard.tsx (component) ── 2 deps
└── ├── ├── ├── 🔧 utils/cn.ts (util) ↻
└── ├── ├── └── 🧩 components/shared/Skeletons.tsx (component) ↻
└── ├── ├── 🧩 components/prashasakah/DateRangeFilter.tsx (component) ★ leaf
└── ├── ├── 🧩 components/prashasakah/BandwidthChart.tsx (component) ★ leaf
└── ├── ├── 🧩 components/prashasakah/PeakUsersChart.tsx (component) ★ leaf
└── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── 📄 pages/prashasakah/Users.tsx (page) ── 5 deps
└── ├── ├── 📦 store/authStore.ts (store) ↻
└── ├── ├── 🔌 services/prashasakahApi.ts (service) ↻
└── ├── ├── 🧩 components/prashasakah/UserTable.tsx (component) ── 1 deps
└── ├── ├── └── 🔌 services/prashasakahApi.ts (service) ↻
└── ├── ├── 🧩 components/prashasakah/UserEditModal.tsx (component) ── 1 deps
└── ├── ├── └── 🔌 services/prashasakahApi.ts (service) ↻
└── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── 📄 pages/prashasakah/UserDetail.tsx (page) ── 6 deps
└── ├── ├── 📦 store/authStore.ts (store) ↻
└── ├── ├── 🔌 services/prashasakahApi.ts (service) ↻
└── ├── ├── 🧩 components/prashasakah/UserActivityLog.tsx (component) ★ leaf
└── ├── ├── 🧩 components/prashasakah/UserEditModal.tsx (component) ↻
└── ├── ├── 🧩 components/prashasakah/ChangePasswordModal.tsx (component) ── 2 deps
└── ├── ├── ├── 🔌 services/prashasakahApi.ts (service) ↻
└── ├── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── 📄 pages/prashasakah/Meetings.tsx (page) ── 3 deps
└── ├── ├── 🔌 services/prashasakahApi.ts (service) ↻
└── ├── ├── 🧩 components/prashasakah/DateRangeFilter.tsx (component) ↻
└── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── 📄 pages/prashasakah/MeetingDetail.tsx (page) ── 3 deps
└── ├── ├── 🔌 services/prashasakahApi.ts (service) ↻
└── ├── ├── 🔧 utils/security.ts (util) ↻
└── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── 📄 pages/prashasakah/AuditLogs.tsx (page) ── 3 deps
└── ├── ├── 🔌 services/prashasakahApi.ts (service) ↻
└── ├── ├── 🧩 components/prashasakah/AuditLogTable.tsx (component) ── 1 deps
└── ├── ├── └── 🔌 services/prashasakahApi.ts (service) ↻
└── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── 📄 pages/prashasakah/Alerts.tsx (page) ── 3 deps
└── ├── ├── 🔌 services/prashasakahApi.ts (service) ↻
└── ├── ├── 🧩 components/prashasakah/AlertList.tsx (component) ── 1 deps
└── ├── ├── └── 🔌 services/prashasakahApi.ts (service) ↻
└── ├── └── 🔧 utils/logger.ts (util) ↻
└── ├── 📄 pages/prashasakah/Settings.tsx (page) ── 3 deps
└── ├── ├── 📦 store/authStore.ts (store) ↻
└── ├── ├── 🔌 services/prashasakahApi.ts (service) ↻
└── ├── └── 🔧 utils/logger.ts (util) ↻
└── └── 📄 pages/prashasakah/ApiKeys.tsx (page) ── 1 deps
└── └── └── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component) ── 3 deps
└── └── └── ├── 🔌 services/prashasakahApi.ts (service) ↻
└── └── └── ├── 📦 store/authStore.ts (store) ↻
└── └── └── └── 🔧 utils/logger.ts (util) ↻
```

### Frontend Orphans (not imported by any file)

```
  ❌ components/chat/index.ts (component) [0 importers] ★ orphan leaf
  ❌ components/panels/WhiteboardPanel.tsx (component) [0 importers] ★ orphan leaf
  ❌ components/pip/index.ts (component) [0 importers] ★ orphan leaf
  ❌ components/prashasakah/SettingsSection.tsx (component) [0 importers] ★ orphan leaf
  ❌ components/prashasakah/index.ts (component) [0 importers] ★ orphan leaf
  ❌ components/prejoin/CreateMeetingForm.tsx (component) [0 importers] ★ orphan leaf
  ❌ components/prejoin/CreateMeetingModal.tsx (component) [0 importers] ★ orphan leaf
  ❌ components/prejoin/JoinForm.tsx (component) [0 importers] ★ orphan leaf
  ❌ components/shared/index.ts (component) [0 importers] ★ orphan leaf
  ❌ hooks/useAutoPiP.ts (hook) [0 importers] ★ orphan leaf
  ❌ hooks/useCpuMonitor.ts (hook) [0 importers] ★ orphan leaf
  ❌ hooks/useLobbyManager.ts (hook) [0 importers] ★ orphan leaf
  ❌ hooks/useMediaSync.ts (hook) [0 importers] ★ orphan leaf
  ❌ hooks/usePermissionEnforcer.ts (hook) [0 importers] ★ orphan leaf
  ❌ hooks/useRequireRole.ts (hook) [0 importers] ★ orphan leaf
  ❌ hooks/useSettingsSync.ts (hook) [0 importers] ★ orphan leaf
  ❌ hooks/useSpeakerManager.ts (hook) [0 importers] ★ orphan leaf
  ❌ main.tsx (entry) [0 importers] ★ orphan leaf
  ❌ services/PiPWindowManager.ts (service) [0 importers] ★ orphan leaf
  ❌ store/pipStore.ts (store) [0 importers] ★ orphan leaf
  ❌ utils/date.ts (util) [0 importers] ★ orphan leaf
```

---

## Backend — Deep N-ary Dependency Tree (All Levels)

_Full recursive expansion from entry point to leaf nodes._

```
🚀 index.ts (entry) ── 17 deps
├── 🛤️ routes/auth.ts (route) ── 8 deps
├── ├── ⚙️ config.ts (config) ── 1 deps
├── ├── └── 🔧 utils/logger.ts (util) ★ leaf
├── ├── 🔌 services/database.ts (service) ── 2 deps
├── ├── ├── ⚙️ config.ts (config) ↻
├── ├── └── 🔧 utils/logger.ts (util) ↻
├── ├── 🛡️ middleware/authenticate.ts (middleware) ── 4 deps
├── ├── ├── ⚙️ config.ts (config) ↻
├── ├── ├── 🔌 services/database.ts (service) ↻
├── ├── ├── 🔌 services/redis.ts (service) ── 2 deps
├── ├── ├── ├── ⚙️ config.ts (config) ↻
├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
├── ├── └── 🔧 utils/logger.ts (util) ↻
├── ├── 🛡️ middleware/rateLimiter.ts (middleware) ★ leaf
├── ├── 🔌 services/redis.ts (service) ↻
├── ├── 🔧 utils/validation.ts (util) ★ leaf
├── ├── 🔧 utils/logger.ts (util) ↻
├── └── 🛡️ middleware/csrf.ts (middleware) ── 1 deps
├── └── └── 🔧 utils/logger.ts (util) ↻
├── 🛤️ routes/token.ts (route) ── 7 deps
├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── 🛡️ middleware/rateLimiter.ts (middleware) ↻
├── ├── 🔌 services/livekit.ts (service) ── 2 deps
├── ├── ├── ⚙️ config.ts (config) ↻
├── ├── └── 🔧 utils/logger.ts (util) ↻
├── ├── 🔌 services/database.ts (service) ↻
├── ├── 🔌 services/roomService.ts (service) ── 2 deps
├── ├── ├── 🔌 services/database.ts (service) ↻
├── ├── └── 🔧 utils/logger.ts (util) ↻
├── ├── 🔌 services/redis.ts (service) ↻
├── └── 🔧 utils/logger.ts (util) ↻
├── 🛤️ routes/rooms.ts (route) ── 10 deps
├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── 🛡️ middleware/requireUser.ts (middleware) ── 1 deps
├── ├── └── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── 🔌 services/livekit.ts (service) ↻
├── ├── 🔌 services/redis.ts (service) ↻
├── ├── 🔌 services/cache.ts (service) ── 2 deps
├── ├── ├── 🔧 utils/logger.ts (util) ↻
├── ├── └── 🔌 services/redis.ts (service) ↻
├── ├── 🔌 services/lobbyService.ts (service) ── 2 deps
├── ├── ├── 🔌 services/livekit.ts (service) ↻
├── ├── └── 🔌 services/redis.ts (service) ↻
├── ├── 🔧 utils/validation.ts (util) ↻
├── ├── 🔧 utils/logger.ts (util) ↻
├── ├── 🔌 services/database.ts (service) ↻
├── └── 🔌 services/roomService.ts (service) ↻
├── 🛤️ routes/meetings.ts (route) ── 8 deps
├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── 🛡️ middleware/requireUser.ts (middleware) ↻
├── ├── 🔌 services/database.ts (service) ↻
├── ├── 🔌 services/meetingService.ts (service) ── 1 deps
├── ├── └── 🔌 services/database.ts (service) ↻
├── ├── 📋 schemas/meetings.ts (schema) ★ leaf
├── ├── 🔧 utils/validation.ts (util) ↻
├── ├── 🔌 services/cache.ts (service) ↻
├── └── 🔧 utils/logger.ts (util) ↻
├── 🛤️ routes/egress.ts (route) ── 5 deps
├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── 🔌 services/livekit.ts (service) ↻
├── ├── 🔌 services/database.ts (service) ↻
├── ├── ⚙️ config.ts (config) ↻
├── └── 🔧 utils/logger.ts (util) ↻
├── 🛤️ routes/webhook.ts (route) ── 5 deps
├── ├── 🔌 services/livekit.ts (service) ↻
├── ├── 🔌 services/database.ts (service) ↻
├── ├── 🔌 services/redis.ts (service) ↻
├── ├── 🔌 services/webhookService.ts (service) ── 3 deps
├── ├── ├── 🔌 services/database.ts (service) ↻
├── ├── ├── 🔌 services/redis.ts (service) ↻
├── ├── └── 🔧 utils/logger.ts (util) ↻
├── └── 🔧 utils/logger.ts (util) ↻
├── 🛤️ routes/prashasakah/index.ts (route) ── 12 deps
├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── 🛤️ routes/prashasakah/rateLimiter.ts (route) ★ leaf
├── ├── 🛤️ routes/prashasakah/stats.ts (route) ── 5 deps
├── ├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── ├── 🛡️ middleware/requireRole.ts (middleware) ── 1 deps
├── ├── ├── └── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── ├── 🔌 services/database.ts (service) ↻
├── ├── ├── 🔌 services/cache.ts (service) ↻
├── ├── └── 🔧 utils/logger.ts (util) ↻
├── ├── 🛤️ routes/prashasakah/health.ts (route) ── 6 deps
├── ├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── ├── 🛡️ middleware/requireRole.ts (middleware) ↻
├── ├── ├── 🔌 services/database.ts (service) ↻
├── ├── ├── 🔌 services/redis.ts (service) ↻
├── ├── ├── ⚙️ config.ts (config) ↻
├── ├── └── 🔧 utils/logger.ts (util) ↻
├── ├── 🛤️ routes/prashasakah/config.ts (route) ── 5 deps
├── ├── ├── 🔌 services/database.ts (service) ↻
├── ├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── ├── 🛡️ middleware/requireRole.ts (middleware) ↻
├── ├── ├── 🔌 services/cache.ts (service) ↻
├── ├── └── 🔧 utils/logger.ts (util) ↻
├── ├── 🛤️ routes/prashasakah/users.ts (route) ── 7 deps
├── ├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── ├── 🛡️ middleware/requireRole.ts (middleware) ↻
├── ├── ├── 🔌 services/database.ts (service) ↻
├── ├── ├── 🔧 utils/validation.ts (util) ↻
├── ├── ├── 🔌 services/cache.ts (service) ↻
├── ├── ├── 🔧 utils/logger.ts (util) ↻
├── ├── └── 🛤️ routes/prashasakah/rateLimiter.ts (route) ↻
├── ├── 🛤️ routes/prashasakah/rooms.ts (route) ── 7 deps
├── ├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── ├── 🛡️ middleware/requireRole.ts (middleware) ↻
├── ├── ├── 🔌 services/database.ts (service) ↻
├── ├── ├── 🔌 services/cache.ts (service) ↻
├── ├── ├── 🔧 utils/logger.ts (util) ↻
├── ├── ├── ⚙️ config.ts (config) ↻
├── ├── └── 🛤️ routes/prashasakah/rateLimiter.ts (route) ↻
├── ├── 🛤️ routes/prashasakah/meetings.ts (route) ── 5 deps
├── ├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── ├── 🛡️ middleware/requireRole.ts (middleware) ↻
├── ├── ├── 🔌 services/database.ts (service) ↻
├── ├── ├── 🔌 services/cache.ts (service) ↻
├── ├── └── 🔧 utils/logger.ts (util) ↻
├── ├── 🛤️ routes/prashasakah/alerts.ts (route) ── 5 deps
├── ├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── ├── 🛡️ middleware/requireRole.ts (middleware) ↻
├── ├── ├── 🔌 services/database.ts (service) ↻
├── ├── ├── 🔌 services/cache.ts (service) ↻
├── ├── └── 🔧 utils/logger.ts (util) ↻
├── ├── 🛤️ routes/prashasakah/auditLogs.ts (route) ── 4 deps
├── ├── ├── 🛡️ middleware/requireRole.ts (middleware) ↻
├── ├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── ├── 🔌 services/database.ts (service) ↻
├── ├── └── 🔧 utils/logger.ts (util) ↻
├── ├── 🛤️ routes/prashasakah/settings.ts (route) ── 4 deps
├── ├── ├── 🛡️ middleware/requireRole.ts (middleware) ↻
├── ├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── ├── 🔌 services/database.ts (service) ↻
├── ├── └── 🔧 utils/logger.ts (util) ↻
├── └── 🛤️ routes/prashasakah/apiKeys.ts (route) ── 6 deps
├── └── ├── 🛡️ middleware/requireRole.ts (middleware) ↻
├── └── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── └── ├── 🔌 services/database.ts (service) ↻
├── └── ├── 🔌 services/cache.ts (service) ↻
├── └── ├── 🔧 utils/logger.ts (util) ↻
├── └── └── 🛤️ routes/prashasakah/rateLimiter.ts (route) ↻
├── 🛤️ routes/apiKeys.ts (route) ── 5 deps
├── ├── 🔌 services/database.ts (service) ↻
├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── 🛡️ middleware/requireRole.ts (middleware) ↻
├── ├── 🔧 utils/logger.ts (util) ↻
├── └── 🔌 services/cache.ts (service) ↻
├── 🛤️ routes/external.ts (route) ── 5 deps
├── ├── 🔌 services/livekit.ts (service) ↻
├── ├── ⚙️ config.ts (config) ↻
├── ├── 🔌 services/database.ts (service) ↻
├── ├── 🔧 utils/logger.ts (util) ↻
├── └── 🛡️ middleware/authenticate.ts (middleware) ↻
├── 🛤️ routes/whiteboard.ts (route) ── 5 deps
├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
├── ├── 🔌 services/livekit.ts (service) ↻
├── ├── 🔌 services/database.ts (service) ↻
├── ├── 🔌 services/roomService.ts (service) ↻
├── └── 🔧 utils/logger.ts (util) ↻
├── 🔌 services/database.ts (service) ↻
├── 🔌 services/redis.ts (service) ↻
├── ⚙️ config.ts (config) ↻
├── 🛡️ middleware/rateLimiter.ts (middleware) ↻
├── 🛡️ middleware/requestId.ts (middleware) ★ leaf
├── 🔧 utils/logger.ts (util) ↻
└── 🛡️ middleware/csrf.ts (middleware) ↻
```

### Backend Orphans (not imported by any file)

```
  ❌ index.ts (entry) [0 importers] ★ orphan leaf
  ❌ services/alertService.ts (service) [0 importers] ★ orphan leaf
```

---

## Frontend — Importer Count (files sorted by how many files import them)

```
├── 🔧 utils/logger.ts (util) ← 55 importers
├── 🔌 services/api.ts (service) ← 23 importers
├── 📦 store/roomStore.ts (store) ← 22 importers
├── 🔧 utils/cn.ts (util) ← 22 importers
├── ⚙️ config/meetingRoomConfig.ts (config) ← 21 importers
├── 📦 store/authStore.ts (store) ← 18 importers
├── 🔤 types/index.ts (type) ← 17 importers
├── 🔌 services/prashasakahApi.ts (service) ← 14 importers
├── 🔧 utils/security.ts (util) ← 8 importers
├── 🧩 components/shared/Skeletons.tsx (component) ← 7 importers
├── 🧩 components/prejoin/types.ts (component) ← 5 importers
├── 🧩 components/shared/PageErrorBoundary.tsx (component) ← 5 importers
├── 🧩 components/chat/chatUtils.tsx (component) ← 4 importers
├── 🧩 components/room/ParticipantTile.tsx (component) ← 4 importers
├── 🔌 services/whiteboardApi.ts (service) ← 4 importers
├── 🧩 components/prashasakah/DateRangeFilter.tsx (component) ← 3 importers
├── 🪝 hooks/useAdmittedParticipants.ts (hook) ← 3 importers
├── 🪝 hooks/useFormValidation.ts (hook) ← 3 importers
├── 🔤 types/api.ts (type) ← 3 importers
├── 🔧 utils/blurProcessorManager.ts (util) ← 3 importers
├── 🧩 components/ErrorBoundary.tsx (component) ← 2 importers
├── 🧩 components/chat/ChatHeader.tsx (component) ← 2 importers
├── 🧩 components/chat/ChatInput.tsx (component) ← 2 importers
├── 🧩 components/chat/ChatMessageList.tsx (component) ← 2 importers
├── 🧩 components/chat/PollCreator.tsx (component) ← 2 importers
├── 🧩 components/pip/PiPContainer.tsx (component) ← 2 importers
├── 🧩 components/pip/PiPControls.tsx (component) ← 2 importers
├── 🧩 components/pip/PiPScreenShare.tsx (component) ← 2 importers
├── 🧩 components/pip/PiPVideoGrid.tsx (component) ← 2 importers
├── 🧩 components/prashasakah/BandwidthChart.tsx (component) ← 2 importers
├── 🧩 components/prashasakah/PeakUsersChart.tsx (component) ← 2 importers
├── 🧩 components/prashasakah/StatCard.tsx (component) ← 2 importers
├── 🧩 components/prashasakah/UserEditModal.tsx (component) ← 2 importers
├── 🧩 components/prejoin/index.ts (component) ← 2 importers
├── 🧩 components/shared/DashboardStats.tsx (component) ← 2 importers
├── 🔄 contexts/ParticipantVisibilityContext.tsx (context) ← 2 importers
├── 🪝 hooks/useMeetingActions.ts (hook) ← 2 importers
├── 🪝 hooks/useNetworkQuality.ts (hook) ← 2 importers
├── 🪝 hooks/useWhiteboardAutoSave.ts (hook) ← 2 importers
├── 🪝 hooks/useWhiteboardSync.ts (hook) ← 2 importers
├── 📄 pages/RoomPage.tsx (page) ← 2 importers
├── 📄 pages/SchedulePage.tsx (page) ← 2 importers
├── 🔧 utils/roomName.ts (util) ← 2 importers
├── 🧩 components/Layout.tsx (component) ← 1 importers
├── 🧩 components/ProtectedRoute.tsx (component) ← 1 importers
├── 🧩 components/controls/ControlBar.tsx (component) ← 1 importers
├── 🧩 components/controls/ControlBarButtons.tsx (component) ← 1 importers
├── 🧩 components/controls/QualityIndicator.tsx (component) ← 1 importers
├── 🧩 components/panels/ChatPanel.tsx (component) ← 1 importers
├── 🧩 components/panels/ParticipantListItem.tsx (component) ← 1 importers
├── 🧩 components/panels/ParticipantsPanel.tsx (component) ← 1 importers
├── 🧩 components/panels/SettingsPanel.tsx (component) ← 1 importers
├── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component) ← 1 importers
├── 🧩 components/prashasakah/AlertList.tsx (component) ← 1 importers
├── 🧩 components/prashasakah/AuditLogTable.tsx (component) ← 1 importers
├── 🧩 components/prashasakah/ChangePasswordModal.tsx (component) ← 1 importers
├── 🧩 components/prashasakah/UserActivityLog.tsx (component) ← 1 importers
├── 🧩 components/prashasakah/UserTable.tsx (component) ← 1 importers
├── 🧩 components/prejoin/AudioSettings.tsx (component) ← 1 importers
├── 🧩 components/prejoin/DeviceSettings.tsx (component) ← 1 importers
├── 🧩 components/prejoin/PreJoinControls.tsx (component) ← 1 importers
├── 🧩 components/prejoin/VideoSettings.tsx (component) ← 1 importers
├── 🧩 components/room/ConferenceRoom.tsx (component) ← 1 importers
├── 🧩 components/room/FloatingParticipantPanel.tsx (component) ← 1 importers
├── 🧩 components/room/GridLayout.tsx (component) ← 1 importers
├── 🧩 components/room/LobbyWaiting.tsx (component) ← 1 importers
├── 🧩 components/room/ScreenShareLayout.tsx (component) ← 1 importers
├── 🧩 components/room/SpeakerLayout.tsx (component) ← 1 importers
├── 🧩 components/room/WhiteboardLayout.tsx (component) ← 1 importers
├── 🧩 components/schedule/MeetingFormModal.tsx (component) ← 1 importers
├── 🧩 components/settings/ApiKeyManager.tsx (component) ← 1 importers
├── 🪝 hooks/useAdaptiveQuality.ts (hook) ← 1 importers
├── 🪝 hooks/useAudioControls.ts (hook) ← 1 importers
├── 🪝 hooks/useCallSizeConfig.ts (hook) ← 1 importers
├── 🪝 hooks/useDataChannelHandler.tsx (hook) ← 1 importers
├── 🪝 hooks/useJoinLeaveSounds.ts (hook) ← 1 importers
├── 🪝 hooks/useLightweightVideoFilter.ts (hook) ← 1 importers
├── 🪝 hooks/useParticipantActions.ts (hook) ← 1 importers
├── 🪝 hooks/usePictureInPicture.ts (hook) ← 1 importers
├── 🪝 hooks/usePreJoinAuth.ts (hook) ← 1 importers
├── 🪝 hooks/usePreJoinMedia.ts (hook) ← 1 importers
├── 🪝 hooks/useQualityMonitoring.ts (hook) ← 1 importers
├── 🪝 hooks/useScreenShareControls.ts (hook) ← 1 importers
├── 🪝 hooks/useTabVisibility.ts (hook) ← 1 importers
├── 🪝 hooks/useTokenRefresh.ts (hook) ← 1 importers
├── 🪝 hooks/useVideoControls.ts (hook) ← 1 importers
├── 🪝 hooks/useVideoPool.ts (hook) ← 1 importers
├── 🪝 hooks/useVisibleParticipants.ts (hook) ← 1 importers
├── 📄 pages/ApiKeysPage.tsx (page) ← 1 importers
├── 📄 pages/ForgotPasswordPage.tsx (page) ← 1 importers
├── 📄 pages/HistoryPage.tsx (page) ← 1 importers
├── 📄 pages/HomePage.tsx (page) ← 1 importers
├── 📄 pages/LoginPage.tsx (page) ← 1 importers
├── 📄 pages/MeetingDetailPage.tsx (page) ← 1 importers
├── 📄 pages/NotFoundPage.tsx (page) ← 1 importers
├── 📄 pages/PreJoinPage.tsx (page) ← 1 importers
├── 📄 pages/RecordingsPage.tsx (page) ← 1 importers
├── 📄 pages/RegisterPage.tsx (page) ← 1 importers
├── 📄 pages/ResetPasswordPage.tsx (page) ← 1 importers
├── 📄 pages/ThankYouPage.tsx (page) ← 1 importers
├── 📄 pages/prashasakah/Alerts.tsx (page) ← 1 importers
├── 📄 pages/prashasakah/ApiKeys.tsx (page) ← 1 importers
├── 📄 pages/prashasakah/AuditLogs.tsx (page) ← 1 importers
├── 📄 pages/prashasakah/Dashboard.tsx (page) ← 1 importers
├── 📄 pages/prashasakah/MeetingDetail.tsx (page) ← 1 importers
├── 📄 pages/prashasakah/Meetings.tsx (page) ← 1 importers
├── 📄 pages/prashasakah/PrashasakahLayout.tsx (page) ← 1 importers
├── 📄 pages/prashasakah/Settings.tsx (page) ← 1 importers
├── 📄 pages/prashasakah/UserDetail.tsx (page) ← 1 importers
├── 📄 pages/prashasakah/Users.tsx (page) ← 1 importers
├── 🔀 router.tsx (router) ← 1 importers
├── 🔌 services/apiKeysApi.ts (service) ← 1 importers
├── 🔤 types/participant.ts (type) ← 1 importers
├── 🔤 types/room.ts (type) ← 1 importers
├── 🔧 utils/cameraCapabilities.ts (util) ← 1 importers
├── 🔧 utils/timezone.ts (util) ← 1 importers
```

---

## Backend — Importer Count (files sorted by how many files import them)

```
├── 🔧 utils/logger.ts (util) ← 29 importers
├── 🔌 services/database.ts (service) ← 25 importers
├── 🛡️ middleware/authenticate.ts (middleware) ← 21 importers
├── 🛡️ middleware/requireRole.ts (middleware) ← 11 importers
├── ⚙️ config.ts (config) ← 10 importers
├── 🔌 services/cache.ts (service) ← 10 importers
├── 🔌 services/redis.ts (service) ← 10 importers
├── 🔌 services/livekit.ts (service) ← 7 importers
├── 🛤️ routes/prashasakah/rateLimiter.ts (route) ← 4 importers
├── 🔧 utils/validation.ts (util) ← 4 importers
├── 🛡️ middleware/rateLimiter.ts (middleware) ← 3 importers
├── 🔌 services/roomService.ts (service) ← 3 importers
├── 🛡️ middleware/csrf.ts (middleware) ← 2 importers
├── 🛡️ middleware/requireUser.ts (middleware) ← 2 importers
├── 🛡️ middleware/requestId.ts (middleware) ← 1 importers
├── 🛤️ routes/apiKeys.ts (route) ← 1 importers
├── 🛤️ routes/auth.ts (route) ← 1 importers
├── 🛤️ routes/egress.ts (route) ← 1 importers
├── 🛤️ routes/external.ts (route) ← 1 importers
├── 🛤️ routes/meetings.ts (route) ← 1 importers
├── 🛤️ routes/prashasakah/alerts.ts (route) ← 1 importers
├── 🛤️ routes/prashasakah/apiKeys.ts (route) ← 1 importers
├── 🛤️ routes/prashasakah/auditLogs.ts (route) ← 1 importers
├── 🛤️ routes/prashasakah/config.ts (route) ← 1 importers
├── 🛤️ routes/prashasakah/health.ts (route) ← 1 importers
├── 🛤️ routes/prashasakah/index.ts (route) ← 1 importers
├── 🛤️ routes/prashasakah/meetings.ts (route) ← 1 importers
├── 🛤️ routes/prashasakah/rooms.ts (route) ← 1 importers
├── 🛤️ routes/prashasakah/settings.ts (route) ← 1 importers
├── 🛤️ routes/prashasakah/stats.ts (route) ← 1 importers
├── 🛤️ routes/prashasakah/users.ts (route) ← 1 importers
├── 🛤️ routes/rooms.ts (route) ← 1 importers
├── 🛤️ routes/token.ts (route) ← 1 importers
├── 🛤️ routes/webhook.ts (route) ← 1 importers
├── 🛤️ routes/whiteboard.ts (route) ← 1 importers
├── 📋 schemas/meetings.ts (schema) ← 1 importers
├── 🔌 services/lobbyService.ts (service) ← 1 importers
├── 🔌 services/meetingService.ts (service) ← 1 importers
├── 🔌 services/webhookService.ts (service) ← 1 importers
```
