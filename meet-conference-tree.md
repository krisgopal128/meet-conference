# Meet Conference — Complete File Dependency Tree

_N-ary tree showing all import relationships from entry points to leaf files._
_Each node's children = files it imports. ★ = leaf (no deps). ↻ = already shown above._

## Project Structure

```
meet-conference/
├── meet-frontend/src/     # React + TypeScript SPA
│   ├── main.tsx              🚀 Entry point
│   ├── router.tsx            🔀 Route tree (lazy-loaded pages)
│   ├── pages/                📄 23 page components
│   │   ├── *.tsx             📄 Public pages (Login, Register, etc.)
│   │   └── prashasakah/      📄 Admin panel pages (10)
│   ├── components/           🧩 57 UI components
│   │   ├── chat/             🧩 Chat UI
│   │   ├── controls/         🧩 Meeting controls
│   │   ├── panels/           🧩 Side panels
│   │   ├── pip/              🧩 Picture-in-Picture
│   │   ├── prejoin/          🧩 Pre-join flow
│   │   ├── prashasakah/      🧩 Admin panel components (12)
│   │   ├── room/             🧩 In-meeting room layout
│   │   ├── schedule/         🧩 Meeting scheduler
│   │   ├── settings/         🧩 API key settings
│   │   └── shared/           🧩 Shared (calendar, stats, skeletons)
│   ├── hooks/                🪝 31 custom hooks
│   ├── services/             🔌 4 API services
│   ├── store/                📦 3 Zustand stores
│   ├── types/                🔤 4 type definition files
│   ├── utils/                🔧 8 utility modules
│   ├── config/               ⚙️ 1 config
│   └── contexts/             🔄 1 React context
│
└── meet-backend/src/      # Node.js + Express API
    ├── index.ts               🚀 Entry point (Express setup)
    ├── config.ts              ⚙️ Environment config
    ├── routes/                🛤️ 20 API route modules
    │   ├── *.ts               🛤️ Public routes (auth, rooms, meetings)
    │   └── prashasakah/       🛤️ Admin routes (12)
    ├── services/              🔌 8 business logic services
    ├── middleware/            🛡️ 5 Express middleware
    ├── schemas/               📋 1 validation schema
    └── utils/                 🔧 2 utilities
```

## Statistics

### Frontend

- **135** files, **343** internal imports
- **26** leaf files (no deps), **20** orphans (no importers)
- Avg **2.5** imports/file

  component: 57 · config: 1 · context: 1 · entry: 1 · hook: 31 · page: 23 · router: 1 · service: 4 · store: 3 · style: 1 · type: 4 · util: 8

### Backend

- **38** files, **137** internal imports
- **6** leaf files (no deps), **1** orphans (no importers)
- Avg **3.6** imports/file

  config: 1 · entry: 1 · middleware: 5 · route: 20 · schema: 1 · service: 8 · utility: 2

---

## Frontend — Deep N-ary Dependency Tree (All Levels)

_Full recursive expansion from entry point to leaf nodes. Max depth: 12_

```
🚀 main.tsx (entry) ── 2 deps
├── 🔀 router.tsx (router) ── 25 deps
│   ├── 🧩 components/Layout.tsx (component) ── 2 deps
│   │   ├── 📦 store/authStore.ts (store) ── 4 deps
│   │   │   ├── 🔤 types/index.ts (type) ── 3 deps
│   │   │   │   ├── 🔤 types/api.ts (type) ── 1 deps
│   │   │   │   │   └── 🔤 types/index.ts (type) ↻
│   │   │   │   ├── 🔤 types/participant.ts (type) ★ leaf
│   │   │   │   └── 🔤 types/room.ts (type) ★ leaf
│   │   │   ├── 🔌 services/api.ts (service) ── 3 deps
│   │   │   │   ├── 🔤 types/api.ts (type) ↻
│   │   │   │   ├── 🔤 types/index.ts (type) ↻
│   │   │   │   └── 🔧 utils/security.ts (util) ★ leaf
│   │   │   ├── 🔧 utils/logger.ts (util) ★ leaf
│   │   │   └── 🔧 utils/security.ts (util) ↻
│   │   └── 🪝 hooks/useTokenRefresh.ts (hook) ── 4 deps
│   │       ├── 📦 store/authStore.ts (store) ↻
│   │       ├── 🔌 services/api.ts (service) ↻
│   │       ├── 🔧 utils/logger.ts (util) ↻
│   │       └── 🔧 utils/security.ts (util) ↻
│   ├── 🧩 components/ProtectedRoute.tsx (component) ── 1 deps
│   │   └── 📦 store/authStore.ts (store) ↻
│   ├── 📄 pages/ApiKeysPage.tsx (page) ── 2 deps
│   │   ├── 📦 store/authStore.ts (store) ↻
│   │   └── 🧩 components/settings/ApiKeyManager.tsx (component) ── 3 deps
│   │       ├── 📦 store/authStore.ts (store) ↻
│   │       ├── 🔌 services/apiKeysApi.ts (service) ── 1 deps
│   │       │   └── 🔌 services/api.ts (service) ↻
│   │       └── 🔧 utils/logger.ts (util) ↻
│   ├── 📄 pages/ForgotPasswordPage.tsx (page) ── 3 deps
│   │   ├── 🔌 services/api.ts (service) ↻
│   │   ├── 🔧 utils/cn.ts (util) ★ leaf
│   │   └── 🪝 hooks/useFormValidation.ts (hook) ★ leaf
│   ├── 📄 pages/HistoryPage.tsx (page) ── 7 deps
│   │   ├── 🔤 types/index.ts (type) ↻
│   │   ├── 🔌 services/api.ts (service) ↻
│   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   ├── 🔧 utils/security.ts (util) ↻
│   │   ├── 🧩 components/shared/PageErrorBoundary.tsx (component) ── 1 deps
│   │   │   └── 🧩 components/ErrorBoundary.tsx (component) ── 1 deps
│   │   │       └── 🔧 utils/logger.ts (util) ↻
│   │   └── 🧩 components/shared/Skeletons.tsx (component) ── 1 deps
│   │       └── 🔧 utils/cn.ts (util) ↻
│   ├── 📄 pages/HomePage.tsx (page) ── 9 deps
│   │   ├── 🔤 types/index.ts (type) ↻
│   │   ├── 📦 store/authStore.ts (store) ↻
│   │   ├── 🔌 services/api.ts (service) ↻
│   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   ├── 🔧 utils/roomName.ts (util) ★ leaf
│   │   ├── 🧩 components/shared/DashboardStats.tsx (component) ── 2 deps
│   │   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   │   └── 🧩 components/shared/Skeletons.tsx (component) ↻
│   │   ├── 🧩 components/shared/PageErrorBoundary.tsx (component) ↻
│   │   └── 🧩 components/shared/Skeletons.tsx (component) ↻
│   ├── 📄 pages/LoginPage.tsx (page) ── 4 deps
│   │   ├── 📦 store/authStore.ts (store) ↻
│   │   ├── 🔌 services/api.ts (service) ↻
│   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   └── 🪝 hooks/useFormValidation.ts (hook) ↻
│   ├── 📄 pages/MeetingDetailPage.tsx (page) ── 7 deps
│   │   ├── 🔤 types/index.ts (type) ↻
│   │   ├── 🔌 services/api.ts (service) ↻
│   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   ├── 🔧 utils/security.ts (util) ↻
│   │   ├── 🧩 components/shared/PageErrorBoundary.tsx (component) ↻
│   │   └── 🧩 components/shared/Skeletons.tsx (component) ↻
│   ├── 📄 pages/NotFoundPage.tsx (page) ★ leaf
│   ├── 📄 pages/PreJoinPage.tsx (page) ── 9 deps
│   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ── 1 deps
│   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   ├── 🔌 services/api.ts (service) ↻
│   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   ├── 🔧 utils/roomName.ts (util) ↻
│   │   ├── 🔧 utils/security.ts (util) ↻
│   │   ├── 🪝 hooks/useLightweightVideoFilter.ts (hook) ── 1 deps
│   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   ├── 🪝 hooks/usePreJoinAuth.ts (hook) ── 4 deps
│   │   │   ├── 🔤 types/index.ts (type) ↻
│   │   │   ├── 📦 store/authStore.ts (store) ↻
│   │   │   ├── 🔌 services/api.ts (service) ↻
│   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   ├── 🪝 hooks/usePreJoinMedia.ts (hook) ── 6 deps
│   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   ├── 📦 store/roomStore.ts (store) ── 2 deps
│   │   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   └── 🔤 types/index.ts (type) ↻
│   │   │   ├── 🔧 utils/blurProcessorManager.ts (util) ── 1 deps
│   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   ├── 🔧 utils/cameraCapabilities.ts (util) ── 1 deps
│   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   │   └── 🧩 components/prejoin/index.ts (component) ── 5 deps
│   │   │       ├── 🧩 components/prejoin/AudioSettings.tsx (component) ── 1 deps
│   │   │       │   └── 🧩 components/prejoin/types.ts (component) ── 1 deps
│   │   │       │       └── 📦 store/roomStore.ts (store) ↻
│   │   │       ├── 🧩 components/prejoin/DeviceSettings.tsx (component) ── 1 deps
│   │   │       │   └── 🧩 components/prejoin/types.ts (component) ↻
│   │   │       ├── 🧩 components/prejoin/PreJoinControls.tsx (component) ── 2 deps
│   │   │       │   ├── 🔧 utils/cn.ts (util) ↻
│   │   │       │   └── 🧩 components/prejoin/types.ts (component) ↻
│   │   │       ├── 🧩 components/prejoin/VideoSettings.tsx (component) ── 2 deps
│   │   │       │   ├── 🔧 utils/cn.ts (util) ↻
│   │   │       │   └── 🧩 components/prejoin/types.ts (component) ↻
│   │   │       └── 🧩 components/prejoin/types.ts (component) ↻
│   │   └── 🧩 components/prejoin/index.ts (component) ↻
│   ├── 📄 pages/RegisterPage.tsx (page) ── 4 deps
│   │   ├── 📦 store/authStore.ts (store) ↻
│   │   ├── 🔌 services/api.ts (service) ↻
│   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   └── 🪝 hooks/useFormValidation.ts (hook) ↻
│   ├── 📄 pages/ResetPasswordPage.tsx (page) ── 2 deps
│   │   ├── 🔌 services/api.ts (service) ↻
│   │   └── 🔧 utils/cn.ts (util) ↻
│   ├── 📄 pages/RoomPage.tsx (page) ── 8 deps
│   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   ├── 🔌 services/api.ts (service) ↻
│   │   ├── 🔧 utils/blurProcessorManager.ts (util) ↻
│   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   ├── 🧩 components/ErrorBoundary.tsx (component) ↻
│   │   ├── 🧩 components/room/ConferenceRoom.tsx (component) ── 17 deps
│   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   ├── 🔧 utils/blurProcessorManager.ts (util) ↻
│   │   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   │   ├── 🔄 contexts/ParticipantVisibilityContext.tsx (context) ── 4 deps
│   │   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   ├── 🪝 hooks/useTabVisibility.ts (hook) ★ leaf
│   │   │   │   ├── 🪝 hooks/useVideoPool.ts (hook) ── 1 deps
│   │   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   │   └── 🪝 hooks/useVisibleParticipants.ts (hook) ★ leaf
│   │   │   ├── 🪝 hooks/useDataChannelHandler.tsx (hook) ── 2 deps
│   │   │   │   ├── 🔤 types/index.ts (type) ↻
│   │   │   │   └── 📦 store/roomStore.ts (store) ↻
│   │   │   ├── 🪝 hooks/useJoinLeaveSounds.ts (hook) ★ leaf
│   │   │   ├── 🪝 hooks/useQualityMonitoring.ts (hook) ── 2 deps
│   │   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   └── 📦 store/roomStore.ts (store) ↻
│   │   │   ├── 🧩 components/controls/ControlBar.tsx (component) ── 11 deps
│   │   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   │   ├── 🔌 services/api.ts (service) ↻
│   │   │   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   │   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   │   │   ├── 🪝 hooks/useAudioControls.ts (hook) ── 2 deps
│   │   │   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   │   ├── 🪝 hooks/useMeetingActions.ts (hook) ── 3 deps
│   │   │   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   │   │   ├── 🔌 services/api.ts (service) ↻
│   │   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   │   ├── 🪝 hooks/usePictureInPicture.ts (hook) ── 1 deps
│   │   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   │   ├── 🪝 hooks/useScreenShareControls.ts (hook) ── 2 deps
│   │   │   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   │   ├── 🪝 hooks/useVideoControls.ts (hook) ── 3 deps
│   │   │   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   │   └── 🧩 components/controls/ControlBarButtons.tsx (component) ── 1 deps
│   │   │   │       └── 🔧 utils/cn.ts (util) ↻
│   │   │   ├── 🧩 components/controls/QualityIndicator.tsx (component) ── 4 deps
│   │   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   │   │   ├── 🪝 hooks/useAdaptiveQuality.ts (hook) ── 2 deps
│   │   │   │   │   ├── 🪝 hooks/useCallSizeConfig.ts (hook) ── 1 deps
│   │   │   │   │   │   └── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   │   └── 🪝 hooks/useNetworkQuality.ts (hook) ── 1 deps
│   │   │   │   │       └── 🔧 utils/logger.ts (util) ↻
│   │   │   │   └── 🪝 hooks/useNetworkQuality.ts (hook) ↻
│   │   │   ├── 🧩 components/panels/ChatPanel.tsx (component) ── 10 deps
│   │   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   ├── 🔤 types/index.ts (type) ↻
│   │   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   │   ├── 🔌 services/api.ts (service) ↻
│   │   │   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   │   │   ├── 🧩 components/chat/ChatHeader.tsx (component) ── 1 deps
│   │   │   │   │   └── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   ├── 🧩 components/chat/ChatInput.tsx (component) ── 2 deps
│   │   │   │   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   │   │   │   └── 🧩 components/chat/chatUtils.tsx (component) ── 1 deps
│   │   │   │   │       └── 🔧 utils/security.ts (util) ↻
│   │   │   │   ├── 🧩 components/chat/ChatMessageList.tsx (component) ── 4 deps
│   │   │   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   │   ├── 🔤 types/index.ts (type) ↻
│   │   │   │   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   │   │   │   └── 🧩 components/chat/chatUtils.tsx (component) ↻
│   │   │   │   ├── 🧩 components/chat/PollCreator.tsx (component) ★ leaf
│   │   │   │   └── 🧩 components/chat/chatUtils.tsx (component) ↻
│   │   │   ├── 🧩 components/panels/ParticipantsPanel.tsx (component) ── 7 deps
│   │   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   ├── 🔤 types/api.ts (type) ↻
│   │   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   │   ├── 🔌 services/api.ts (service) ↻
│   │   │   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   │   │   ├── 🪝 hooks/useParticipantActions.ts (hook) ── 2 deps
│   │   │   │   │   ├── 🔌 services/api.ts (service) ↻
│   │   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   │   └── 🧩 components/panels/ParticipantListItem.tsx (component) ── 1 deps
│   │   │   │       └── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   ├── 🧩 components/panels/SettingsPanel.tsx (component) ── 4 deps
│   │   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   │   ├── 🔌 services/api.ts (service) ↻
│   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   ├── 🧩 components/pip/PiPContainer.tsx (component) ── 5 deps
│   │   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   │   │   ├── 🧩 components/pip/PiPControls.tsx (component) ── 2 deps
│   │   │   │   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   │   ├── 🧩 components/pip/PiPScreenShare.tsx (component) ★ leaf
│   │   │   │   └── 🧩 components/pip/PiPVideoGrid.tsx (component) ── 1 deps
│   │   │   │       └── 📦 store/roomStore.ts (store) ↻
│   │   │   ├── 🧩 components/room/GridLayout.tsx (component) ── 3 deps
│   │   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   │   ├── 🪝 hooks/useAdmittedParticipants.ts (hook) ── 1 deps
│   │   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   │   └── 🧩 components/room/ParticipantTile.tsx (component) ── 4 deps
│   │   │   │       ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │       ├── 📦 store/roomStore.ts (store) ↻
│   │   │   │       ├── 🔧 utils/logger.ts (util) ↻
│   │   │   │       └── 🔄 contexts/ParticipantVisibilityContext.tsx (context) ↻
│   │   │   ├── 🧩 components/room/ScreenShareLayout.tsx (component) ── 1 deps
│   │   │   │   └── 🧩 components/room/ParticipantTile.tsx (component) ↻
│   │   │   └── 🧩 components/room/SpeakerLayout.tsx (component) ── 3 deps
│   │   │       ├── 📦 store/roomStore.ts (store) ↻
│   │   │       ├── 🪝 hooks/useAdmittedParticipants.ts (hook) ↻
│   │   │       └── 🧩 components/room/ParticipantTile.tsx (component) ↻
│   │   └── 🧩 components/room/LobbyWaiting.tsx (component) ── 1 deps
│   │       └── 🔧 utils/logger.ts (util) ↻
│   ├── 📄 pages/SchedulePage.tsx (page) ── 7 deps
│   │   ├── 🔤 types/index.ts (type) ↻
│   │   ├── 🔌 services/api.ts (service) ↻
│   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   ├── 🔧 utils/timezone.ts (util) ★ leaf
│   │   ├── 🧩 components/schedule/MeetingFormModal.tsx (component) ── 2 deps
│   │   │   ├── 🔤 types/index.ts (type) ↻
│   │   │   └── 🔧 utils/cn.ts (util) ↻
│   │   └── 🧩 components/shared/PageErrorBoundary.tsx (component) ↻
│   ├── 📄 pages/ThankYouPage.tsx (page) ── 1 deps
│   │   └── 📦 store/authStore.ts (store) ↻
│   ├── 📄 pages/prashasakah/Alerts.tsx (page) ── 3 deps
│   │   ├── 🔌 services/prashasakahApi.ts (service) ── 1 deps
│   │   │   └── 🔌 services/api.ts (service) ↻
│   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   └── 🧩 components/prashasakah/AlertList.tsx (component) ── 1 deps
│   │       └── 🔌 services/prashasakahApi.ts (service) ↻
│   ├── 📄 pages/prashasakah/ApiKeys.tsx (page) ── 1 deps
│   │   └── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component) ── 3 deps
│   │       ├── 📦 store/authStore.ts (store) ↻
│   │       ├── 🔌 services/prashasakahApi.ts (service) ↻
│   │       └── 🔧 utils/logger.ts (util) ↻
│   ├── 📄 pages/prashasakah/AuditLogs.tsx (page) ── 3 deps
│   │   ├── 🔌 services/prashasakahApi.ts (service) ↻
│   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   └── 🧩 components/prashasakah/AuditLogTable.tsx (component) ── 1 deps
│   │       └── 🔌 services/prashasakahApi.ts (service) ↻
│   ├── 📄 pages/prashasakah/Dashboard.tsx (page) ── 7 deps
│   │   ├── 📦 store/authStore.ts (store) ↻
│   │   ├── 🔌 services/prashasakahApi.ts (service) ↻
│   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   ├── 🧩 components/prashasakah/BandwidthChart.tsx (component) ★ leaf
│   │   ├── 🧩 components/prashasakah/DateRangeFilter.tsx (component) ★ leaf
│   │   ├── 🧩 components/prashasakah/PeakUsersChart.tsx (component) ★ leaf
│   │   └── 🧩 components/prashasakah/StatCard.tsx (component) ── 2 deps
│   │       ├── 🔧 utils/cn.ts (util) ↻
│   │       └── 🧩 components/shared/Skeletons.tsx (component) ↻
│   ├── 📄 pages/prashasakah/MeetingDetail.tsx (page) ── 3 deps
│   │   ├── 🔌 services/prashasakahApi.ts (service) ↻
│   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   └── 🔧 utils/security.ts (util) ↻
│   ├── 📄 pages/prashasakah/Meetings.tsx (page) ── 3 deps
│   │   ├── 🔌 services/prashasakahApi.ts (service) ↻
│   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   └── 🧩 components/prashasakah/DateRangeFilter.tsx (component) ↻
│   ├── 📄 pages/prashasakah/PrashasakahLayout.tsx (page) ── 1 deps
│   │   └── 📦 store/authStore.ts (store) ↻
│   ├── 📄 pages/prashasakah/Settings.tsx (page) ── 3 deps
│   │   ├── 📦 store/authStore.ts (store) ↻
│   │   ├── 🔌 services/prashasakahApi.ts (service) ↻
│   │   └── 🔧 utils/logger.ts (util) ↻
│   ├── 📄 pages/prashasakah/UserDetail.tsx (page) ── 6 deps
│   │   ├── 📦 store/authStore.ts (store) ↻
│   │   ├── 🔌 services/prashasakahApi.ts (service) ↻
│   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   ├── 🧩 components/prashasakah/ChangePasswordModal.tsx (component) ── 2 deps
│   │   │   ├── 🔌 services/prashasakahApi.ts (service) ↻
│   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   ├── 🧩 components/prashasakah/UserActivityLog.tsx (component) ★ leaf
│   │   └── 🧩 components/prashasakah/UserEditModal.tsx (component) ── 1 deps
│   │       └── 🔌 services/prashasakahApi.ts (service) ↻
│   └── 📄 pages/prashasakah/Users.tsx (page) ── 5 deps
│       ├── 📦 store/authStore.ts (store) ↻
│       ├── 🔌 services/prashasakahApi.ts (service) ↻
│       ├── 🔧 utils/logger.ts (util) ↻
│       ├── 🧩 components/prashasakah/UserEditModal.tsx (component) ↻
│       └── 🧩 components/prashasakah/UserTable.tsx (component) ── 1 deps
│           └── 🔌 services/prashasakahApi.ts (service) ↻
└── 🎨 index.css (style) ★ leaf

Total unique files in tree: 111/135

🔀 router.tsx (router) ── 25 deps
├── 🧩 components/Layout.tsx (component) ── 2 deps
│   ├── 📦 store/authStore.ts (store) ── 4 deps
│   │   ├── 🔤 types/index.ts (type) ── 3 deps
│   │   │   ├── 🔤 types/api.ts (type) ── 1 deps
│   │   │   │   └── 🔤 types/index.ts (type) ↻
│   │   │   ├── 🔤 types/participant.ts (type) ★ leaf
│   │   │   └── 🔤 types/room.ts (type) ★ leaf
│   │   ├── 🔌 services/api.ts (service) ── 3 deps
│   │   │   ├── 🔤 types/api.ts (type) ↻
│   │   │   ├── 🔤 types/index.ts (type) ↻
│   │   │   └── 🔧 utils/security.ts (util) ★ leaf
│   │   ├── 🔧 utils/logger.ts (util) ★ leaf
│   │   └── 🔧 utils/security.ts (util) ↻
│   └── 🪝 hooks/useTokenRefresh.ts (hook) ── 4 deps
│       ├── 📦 store/authStore.ts (store) ↻
│       ├── 🔌 services/api.ts (service) ↻
│       ├── 🔧 utils/logger.ts (util) ↻
│       └── 🔧 utils/security.ts (util) ↻
├── 🧩 components/ProtectedRoute.tsx (component) ── 1 deps
│   └── 📦 store/authStore.ts (store) ↻
├── 📄 pages/ApiKeysPage.tsx (page) ── 2 deps
│   ├── 📦 store/authStore.ts (store) ↻
│   └── 🧩 components/settings/ApiKeyManager.tsx (component) ── 3 deps
│       ├── 📦 store/authStore.ts (store) ↻
│       ├── 🔌 services/apiKeysApi.ts (service) ── 1 deps
│       │   └── 🔌 services/api.ts (service) ↻
│       └── 🔧 utils/logger.ts (util) ↻
├── 📄 pages/ForgotPasswordPage.tsx (page) ── 3 deps
│   ├── 🔌 services/api.ts (service) ↻
│   ├── 🔧 utils/cn.ts (util) ★ leaf
│   └── 🪝 hooks/useFormValidation.ts (hook) ★ leaf
├── 📄 pages/HistoryPage.tsx (page) ── 7 deps
│   ├── 🔤 types/index.ts (type) ↻
│   ├── 🔌 services/api.ts (service) ↻
│   ├── 🔧 utils/cn.ts (util) ↻
│   ├── 🔧 utils/logger.ts (util) ↻
│   ├── 🔧 utils/security.ts (util) ↻
│   ├── 🧩 components/shared/PageErrorBoundary.tsx (component) ── 1 deps
│   │   └── 🧩 components/ErrorBoundary.tsx (component) ── 1 deps
│   │       └── 🔧 utils/logger.ts (util) ↻
│   └── 🧩 components/shared/Skeletons.tsx (component) ── 1 deps
│       └── 🔧 utils/cn.ts (util) ↻
├── 📄 pages/HomePage.tsx (page) ── 9 deps
│   ├── 🔤 types/index.ts (type) ↻
│   ├── 📦 store/authStore.ts (store) ↻
│   ├── 🔌 services/api.ts (service) ↻
│   ├── 🔧 utils/cn.ts (util) ↻
│   ├── 🔧 utils/logger.ts (util) ↻
│   ├── 🔧 utils/roomName.ts (util) ★ leaf
│   ├── 🧩 components/shared/DashboardStats.tsx (component) ── 2 deps
│   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   └── 🧩 components/shared/Skeletons.tsx (component) ↻
│   ├── 🧩 components/shared/PageErrorBoundary.tsx (component) ↻
│   └── 🧩 components/shared/Skeletons.tsx (component) ↻
├── 📄 pages/LoginPage.tsx (page) ── 4 deps
│   ├── 📦 store/authStore.ts (store) ↻
│   ├── 🔌 services/api.ts (service) ↻
│   ├── 🔧 utils/cn.ts (util) ↻
│   └── 🪝 hooks/useFormValidation.ts (hook) ↻
├── 📄 pages/MeetingDetailPage.tsx (page) ── 7 deps
│   ├── 🔤 types/index.ts (type) ↻
│   ├── 🔌 services/api.ts (service) ↻
│   ├── 🔧 utils/cn.ts (util) ↻
│   ├── 🔧 utils/logger.ts (util) ↻
│   ├── 🔧 utils/security.ts (util) ↻
│   ├── 🧩 components/shared/PageErrorBoundary.tsx (component) ↻
│   └── 🧩 components/shared/Skeletons.tsx (component) ↻
├── 📄 pages/NotFoundPage.tsx (page) ★ leaf
├── 📄 pages/PreJoinPage.tsx (page) ── 9 deps
│   ├── ⚙️ config/meetingRoomConfig.ts (config) ── 1 deps
│   │   └── 🔧 utils/logger.ts (util) ↻
│   ├── 🔌 services/api.ts (service) ↻
│   ├── 🔧 utils/cn.ts (util) ↻
│   ├── 🔧 utils/roomName.ts (util) ↻
│   ├── 🔧 utils/security.ts (util) ↻
│   ├── 🪝 hooks/useLightweightVideoFilter.ts (hook) ── 1 deps
│   │   └── 🔧 utils/logger.ts (util) ↻
│   ├── 🪝 hooks/usePreJoinAuth.ts (hook) ── 4 deps
│   │   ├── 🔤 types/index.ts (type) ↻
│   │   ├── 📦 store/authStore.ts (store) ↻
│   │   ├── 🔌 services/api.ts (service) ↻
│   │   └── 🔧 utils/logger.ts (util) ↻
│   ├── 🪝 hooks/usePreJoinMedia.ts (hook) ── 6 deps
│   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   ├── 📦 store/roomStore.ts (store) ── 2 deps
│   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   └── 🔤 types/index.ts (type) ↻
│   │   ├── 🔧 utils/blurProcessorManager.ts (util) ── 1 deps
│   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   ├── 🔧 utils/cameraCapabilities.ts (util) ── 1 deps
│   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   └── 🧩 components/prejoin/index.ts (component) ── 5 deps
│   │       ├── 🧩 components/prejoin/AudioSettings.tsx (component) ── 1 deps
│   │       │   └── 🧩 components/prejoin/types.ts (component) ── 1 deps
│   │       │       └── 📦 store/roomStore.ts (store) ↻
│   │       ├── 🧩 components/prejoin/DeviceSettings.tsx (component) ── 1 deps
│   │       │   └── 🧩 components/prejoin/types.ts (component) ↻
│   │       ├── 🧩 components/prejoin/PreJoinControls.tsx (component) ── 2 deps
│   │       │   ├── 🔧 utils/cn.ts (util) ↻
│   │       │   └── 🧩 components/prejoin/types.ts (component) ↻
│   │       ├── 🧩 components/prejoin/VideoSettings.tsx (component) ── 2 deps
│   │       │   ├── 🔧 utils/cn.ts (util) ↻
│   │       │   └── 🧩 components/prejoin/types.ts (component) ↻
│   │       └── 🧩 components/prejoin/types.ts (component) ↻
│   └── 🧩 components/prejoin/index.ts (component) ↻
├── 📄 pages/RegisterPage.tsx (page) ── 4 deps
│   ├── 📦 store/authStore.ts (store) ↻
│   ├── 🔌 services/api.ts (service) ↻
│   ├── 🔧 utils/cn.ts (util) ↻
│   └── 🪝 hooks/useFormValidation.ts (hook) ↻
├── 📄 pages/ResetPasswordPage.tsx (page) ── 2 deps
│   ├── 🔌 services/api.ts (service) ↻
│   └── 🔧 utils/cn.ts (util) ↻
├── 📄 pages/RoomPage.tsx (page) ── 8 deps
│   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   ├── 📦 store/roomStore.ts (store) ↻
│   ├── 🔌 services/api.ts (service) ↻
│   ├── 🔧 utils/blurProcessorManager.ts (util) ↻
│   ├── 🔧 utils/logger.ts (util) ↻
│   ├── 🧩 components/ErrorBoundary.tsx (component) ↻
│   ├── 🧩 components/room/ConferenceRoom.tsx (component) ── 17 deps
│   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   ├── 🔧 utils/blurProcessorManager.ts (util) ↻
│   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   ├── 🔄 contexts/ParticipantVisibilityContext.tsx (context) ── 4 deps
│   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   ├── 🪝 hooks/useTabVisibility.ts (hook) ★ leaf
│   │   │   ├── 🪝 hooks/useVideoPool.ts (hook) ── 1 deps
│   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   └── 🪝 hooks/useVisibleParticipants.ts (hook) ★ leaf
│   │   ├── 🪝 hooks/useDataChannelHandler.tsx (hook) ── 2 deps
│   │   │   ├── 🔤 types/index.ts (type) ↻
│   │   │   └── 📦 store/roomStore.ts (store) ↻
│   │   ├── 🪝 hooks/useJoinLeaveSounds.ts (hook) ★ leaf
│   │   ├── 🪝 hooks/useQualityMonitoring.ts (hook) ── 2 deps
│   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   └── 📦 store/roomStore.ts (store) ↻
│   │   ├── 🧩 components/controls/ControlBar.tsx (component) ── 11 deps
│   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   ├── 🔌 services/api.ts (service) ↻
│   │   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   │   ├── 🪝 hooks/useAudioControls.ts (hook) ── 2 deps
│   │   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   ├── 🪝 hooks/useMeetingActions.ts (hook) ── 3 deps
│   │   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   │   ├── 🔌 services/api.ts (service) ↻
│   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   ├── 🪝 hooks/usePictureInPicture.ts (hook) ── 1 deps
│   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   ├── 🪝 hooks/useScreenShareControls.ts (hook) ── 2 deps
│   │   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   ├── 🪝 hooks/useVideoControls.ts (hook) ── 3 deps
│   │   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   └── 🧩 components/controls/ControlBarButtons.tsx (component) ── 1 deps
│   │   │       └── 🔧 utils/cn.ts (util) ↻
│   │   ├── 🧩 components/controls/QualityIndicator.tsx (component) ── 4 deps
│   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   │   ├── 🪝 hooks/useAdaptiveQuality.ts (hook) ── 2 deps
│   │   │   │   ├── 🪝 hooks/useCallSizeConfig.ts (hook) ── 1 deps
│   │   │   │   │   └── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   └── 🪝 hooks/useNetworkQuality.ts (hook) ── 1 deps
│   │   │   │       └── 🔧 utils/logger.ts (util) ↻
│   │   │   └── 🪝 hooks/useNetworkQuality.ts (hook) ↻
│   │   ├── 🧩 components/panels/ChatPanel.tsx (component) ── 10 deps
│   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   ├── 🔤 types/index.ts (type) ↻
│   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   ├── 🔌 services/api.ts (service) ↻
│   │   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   │   ├── 🧩 components/chat/ChatHeader.tsx (component) ── 1 deps
│   │   │   │   └── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   ├── 🧩 components/chat/ChatInput.tsx (component) ── 2 deps
│   │   │   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   │   │   └── 🧩 components/chat/chatUtils.tsx (component) ── 1 deps
│   │   │   │       └── 🔧 utils/security.ts (util) ↻
│   │   │   ├── 🧩 components/chat/ChatMessageList.tsx (component) ── 4 deps
│   │   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   │   ├── 🔤 types/index.ts (type) ↻
│   │   │   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   │   │   └── 🧩 components/chat/chatUtils.tsx (component) ↻
│   │   │   ├── 🧩 components/chat/PollCreator.tsx (component) ★ leaf
│   │   │   └── 🧩 components/chat/chatUtils.tsx (component) ↻
│   │   ├── 🧩 components/panels/ParticipantsPanel.tsx (component) ── 7 deps
│   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   ├── 🔤 types/api.ts (type) ↻
│   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   ├── 🔌 services/api.ts (service) ↻
│   │   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   │   ├── 🪝 hooks/useParticipantActions.ts (hook) ── 2 deps
│   │   │   │   ├── 🔌 services/api.ts (service) ↻
│   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   └── 🧩 components/panels/ParticipantListItem.tsx (component) ── 1 deps
│   │   │       └── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   ├── 🧩 components/panels/SettingsPanel.tsx (component) ── 4 deps
│   │   │   ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   ├── 🔌 services/api.ts (service) ↻
│   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   ├── 🧩 components/pip/PiPContainer.tsx (component) ── 5 deps
│   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   ├── 🔧 utils/logger.ts (util) ↻
│   │   │   ├── 🧩 components/pip/PiPControls.tsx (component) ── 2 deps
│   │   │   │   ├── 🔧 utils/cn.ts (util) ↻
│   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   ├── 🧩 components/pip/PiPScreenShare.tsx (component) ★ leaf
│   │   │   └── 🧩 components/pip/PiPVideoGrid.tsx (component) ── 1 deps
│   │   │       └── 📦 store/roomStore.ts (store) ↻
│   │   ├── 🧩 components/room/GridLayout.tsx (component) ── 3 deps
│   │   │   ├── 📦 store/roomStore.ts (store) ↻
│   │   │   ├── 🪝 hooks/useAdmittedParticipants.ts (hook) ── 1 deps
│   │   │   │   └── 🔧 utils/logger.ts (util) ↻
│   │   │   └── 🧩 components/room/ParticipantTile.tsx (component) ── 4 deps
│   │   │       ├── ⚙️ config/meetingRoomConfig.ts (config) ↻
│   │   │       ├── 📦 store/roomStore.ts (store) ↻
│   │   │       ├── 🔧 utils/logger.ts (util) ↻
│   │   │       └── 🔄 contexts/ParticipantVisibilityContext.tsx (context) ↻
│   │   ├── 🧩 components/room/ScreenShareLayout.tsx (component) ── 1 deps
│   │   │   └── 🧩 components/room/ParticipantTile.tsx (component) ↻
│   │   └── 🧩 components/room/SpeakerLayout.tsx (component) ── 3 deps
│   │       ├── 📦 store/roomStore.ts (store) ↻
│   │       ├── 🪝 hooks/useAdmittedParticipants.ts (hook) ↻
│   │       └── 🧩 components/room/ParticipantTile.tsx (component) ↻
│   └── 🧩 components/room/LobbyWaiting.tsx (component) ── 1 deps
│       └── 🔧 utils/logger.ts (util) ↻
├── 📄 pages/SchedulePage.tsx (page) ── 7 deps
│   ├── 🔤 types/index.ts (type) ↻
│   ├── 🔌 services/api.ts (service) ↻
│   ├── 🔧 utils/cn.ts (util) ↻
│   ├── 🔧 utils/logger.ts (util) ↻
│   ├── 🔧 utils/timezone.ts (util) ★ leaf
│   ├── 🧩 components/schedule/MeetingFormModal.tsx (component) ── 2 deps
│   │   ├── 🔤 types/index.ts (type) ↻
│   │   └── 🔧 utils/cn.ts (util) ↻
│   └── 🧩 components/shared/PageErrorBoundary.tsx (component) ↻
├── 📄 pages/ThankYouPage.tsx (page) ── 1 deps
│   └── 📦 store/authStore.ts (store) ↻
├── 📄 pages/prashasakah/Alerts.tsx (page) ── 3 deps
│   ├── 🔌 services/prashasakahApi.ts (service) ── 1 deps
│   │   └── 🔌 services/api.ts (service) ↻
│   ├── 🔧 utils/logger.ts (util) ↻
│   └── 🧩 components/prashasakah/AlertList.tsx (component) ── 1 deps
│       └── 🔌 services/prashasakahApi.ts (service) ↻
├── 📄 pages/prashasakah/ApiKeys.tsx (page) ── 1 deps
│   └── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component) ── 3 deps
│       ├── 📦 store/authStore.ts (store) ↻
│       ├── 🔌 services/prashasakahApi.ts (service) ↻
│       └── 🔧 utils/logger.ts (util) ↻
├── 📄 pages/prashasakah/AuditLogs.tsx (page) ── 3 deps
│   ├── 🔌 services/prashasakahApi.ts (service) ↻
│   ├── 🔧 utils/logger.ts (util) ↻
│   └── 🧩 components/prashasakah/AuditLogTable.tsx (component) ── 1 deps
│       └── 🔌 services/prashasakahApi.ts (service) ↻
├── 📄 pages/prashasakah/Dashboard.tsx (page) ── 7 deps
│   ├── 📦 store/authStore.ts (store) ↻
│   ├── 🔌 services/prashasakahApi.ts (service) ↻
│   ├── 🔧 utils/logger.ts (util) ↻
│   ├── 🧩 components/prashasakah/BandwidthChart.tsx (component) ★ leaf
│   ├── 🧩 components/prashasakah/DateRangeFilter.tsx (component) ★ leaf
│   ├── 🧩 components/prashasakah/PeakUsersChart.tsx (component) ★ leaf
│   └── 🧩 components/prashasakah/StatCard.tsx (component) ── 2 deps
│       ├── 🔧 utils/cn.ts (util) ↻
│       └── 🧩 components/shared/Skeletons.tsx (component) ↻
├── 📄 pages/prashasakah/MeetingDetail.tsx (page) ── 3 deps
│   ├── 🔌 services/prashasakahApi.ts (service) ↻
│   ├── 🔧 utils/logger.ts (util) ↻
│   └── 🔧 utils/security.ts (util) ↻
├── 📄 pages/prashasakah/Meetings.tsx (page) ── 3 deps
│   ├── 🔌 services/prashasakahApi.ts (service) ↻
│   ├── 🔧 utils/logger.ts (util) ↻
│   └── 🧩 components/prashasakah/DateRangeFilter.tsx (component) ↻
├── 📄 pages/prashasakah/PrashasakahLayout.tsx (page) ── 1 deps
│   └── 📦 store/authStore.ts (store) ↻
├── 📄 pages/prashasakah/Settings.tsx (page) ── 3 deps
│   ├── 📦 store/authStore.ts (store) ↻
│   ├── 🔌 services/prashasakahApi.ts (service) ↻
│   └── 🔧 utils/logger.ts (util) ↻
├── 📄 pages/prashasakah/UserDetail.tsx (page) ── 6 deps
│   ├── 📦 store/authStore.ts (store) ↻
│   ├── 🔌 services/prashasakahApi.ts (service) ↻
│   ├── 🔧 utils/logger.ts (util) ↻
│   ├── 🧩 components/prashasakah/ChangePasswordModal.tsx (component) ── 2 deps
│   │   ├── 🔌 services/prashasakahApi.ts (service) ↻
│   │   └── 🔧 utils/logger.ts (util) ↻
│   ├── 🧩 components/prashasakah/UserActivityLog.tsx (component) ★ leaf
│   └── 🧩 components/prashasakah/UserEditModal.tsx (component) ── 1 deps
│       └── 🔌 services/prashasakahApi.ts (service) ↻
└── 📄 pages/prashasakah/Users.tsx (page) ── 5 deps
    ├── 📦 store/authStore.ts (store) ↻
    ├── 🔌 services/prashasakahApi.ts (service) ↻
    ├── 🔧 utils/logger.ts (util) ↻
    ├── 🧩 components/prashasakah/UserEditModal.tsx (component) ↻
    └── 🧩 components/prashasakah/UserTable.tsx (component) ── 1 deps
        └── 🔌 services/prashasakahApi.ts (service) ↻

Total unique files in tree: 109/135


┌─────────────────────────────────────────────
│ ⚠️  UNREACHABLE from entry point (orphans)
└─────────────────────────────────────────────
  ❌ components/chat/index.ts (component) [5 deps, 0 importers] ★ orphan leaf
  ❌ components/pip/pip.css (component) [0 deps, 0 importers] ★ orphan leaf
  ❌ components/prashasakah/SettingsSection.tsx (component) [0 deps, 0 importers] ★ orphan leaf
  ❌ components/prashasakah/index.ts (component) [4 deps, 0 importers] ★ orphan leaf
  ❌ components/prejoin/CreateMeetingForm.tsx (component) [0 deps, 0 importers] ★ orphan leaf
  ❌ components/prejoin/CreateMeetingModal.tsx (component) [2 deps, 0 importers] ★ orphan leaf
  ❌ components/prejoin/JoinForm.tsx (component) [1 deps, 0 importers] ★ orphan leaf
  ❌ components/shared/index.ts (component) [4 deps, 0 importers]
  └── components/shared/DashboardCalendar.tsx (component)
  ❌ hooks/useAutoPiP.ts (hook) [1 deps, 0 importers] ★ orphan leaf
  ❌ hooks/useCpuMonitor.ts (hook) [3 deps, 0 importers]
  └── hooks/useFpsMonitor.ts (hook)
  ❌ hooks/useLeaveMeeting.ts (hook) [2 deps, 0 importers] ★ orphan leaf
  ❌ hooks/useLobbyManager.ts (hook) [0 deps, 0 importers] ★ orphan leaf
  ❌ hooks/useMediaSync.ts (hook) [2 deps, 0 importers] ★ orphan leaf
  ❌ hooks/usePermissionEnforcer.ts (hook) [2 deps, 0 importers] ★ orphan leaf
  ❌ hooks/useRequireRole.ts (hook) [2 deps, 0 importers] ★ orphan leaf
  ❌ hooks/useSettingsSync.ts (hook) [1 deps, 0 importers] ★ orphan leaf
  ❌ hooks/useSpeakerManager.ts (hook) [1 deps, 0 importers] ★ orphan leaf
  ❌ services/PiPWindowManager.ts (service) [1 deps, 0 importers] ★ orphan leaf
  ❌ store/pipStore.ts (store) [0 deps, 0 importers] ★ orphan leaf
  ❌ utils/date.ts (util) [0 deps, 0 importers] ★ orphan leaf
```
---

## Backend — Deep N-ary Dependency Tree (All Levels)

_Full recursive expansion from entry point to leaf nodes. Max depth: 12_

```
🚀 index.ts (entry) ── 15 deps
├── ⚙️ config.ts (config) ── 1 deps
│   └── 🔧 utils/logger.ts (utility) ★ leaf
├── 🔌 services/database.ts (service) ── 2 deps
│   ├── ⚙️ config.ts (config) ↻
│   └── 🔧 utils/logger.ts (utility) ↻
├── 🔌 services/redis.ts (service) ── 2 deps
│   ├── ⚙️ config.ts (config) ↻
│   └── 🔧 utils/logger.ts (utility) ↻
├── 🔧 utils/logger.ts (utility) ↻
├── 🛡️ middleware/rateLimiter.ts (middleware) ★ leaf
├── 🛡️ middleware/requestId.ts (middleware) ★ leaf
├── 🛤️ routes/apiKeys.ts (route) ── 4 deps
│   ├── 🔌 services/database.ts (service) ↻
│   ├── 🔧 utils/logger.ts (utility) ↻
│   ├── 🛡️ middleware/authenticate.ts (middleware) ── 4 deps
│   │   ├── ⚙️ config.ts (config) ↻
│   │   ├── 🔌 services/database.ts (service) ↻
│   │   ├── 🔌 services/redis.ts (service) ↻
│   │   └── 🔧 utils/logger.ts (utility) ↻
│   └── 🛡️ middleware/requireRole.ts (middleware) ── 1 deps
│       └── 🛡️ middleware/authenticate.ts (middleware) ↻
├── 🛤️ routes/auth.ts (route) ── 7 deps
│   ├── ⚙️ config.ts (config) ↻
│   ├── 🔌 services/database.ts (service) ↻
│   ├── 🔌 services/redis.ts (service) ↻
│   ├── 🔧 utils/logger.ts (utility) ↻
│   ├── 🔧 utils/validation.ts (utility) ★ leaf
│   ├── 🛡️ middleware/authenticate.ts (middleware) ↻
│   └── 🛡️ middleware/rateLimiter.ts (middleware) ↻
├── 🛤️ routes/egress.ts (route) ── 5 deps
│   ├── ⚙️ config.ts (config) ↻
│   ├── 🔌 services/database.ts (service) ↻
│   ├── 🔌 services/livekit.ts (service) ── 2 deps
│   │   ├── ⚙️ config.ts (config) ↻
│   │   └── 🔧 utils/logger.ts (utility) ↻
│   ├── 🔧 utils/logger.ts (utility) ↻
│   └── 🛡️ middleware/authenticate.ts (middleware) ↻
├── 🛤️ routes/external.ts (route) ── 3 deps
│   ├── 🔌 services/database.ts (service) ↻
│   ├── 🔧 utils/logger.ts (utility) ↻
│   └── 🛡️ middleware/authenticate.ts (middleware) ↻
├── 🛤️ routes/meetings.ts (route) ── 7 deps
│   ├── 🔌 services/database.ts (service) ↻
│   ├── 🔌 services/meetingService.ts (service) ── 1 deps
│   │   └── 🔌 services/database.ts (service) ↻
│   ├── 🔧 utils/logger.ts (utility) ↻
│   ├── 🔧 utils/validation.ts (utility) ↻
│   ├── 🛡️ middleware/authenticate.ts (middleware) ↻
│   ├── 🛡️ middleware/requireUser.ts (middleware) ── 1 deps
│   │   └── 🛡️ middleware/authenticate.ts (middleware) ↻
│   └── 📋 schemas/meetings.ts (schema) ★ leaf
├── 🛤️ routes/prashasakah/index.ts (route) ── 12 deps
│   ├── 🛡️ middleware/authenticate.ts (middleware) ↻
│   ├── 🛤️ routes/prashasakah/alerts.ts (route) ── 4 deps
│   │   ├── 🔌 services/database.ts (service) ↻
│   │   ├── 🔧 utils/logger.ts (utility) ↻
│   │   ├── 🛡️ middleware/authenticate.ts (middleware) ↻
│   │   └── 🛡️ middleware/requireRole.ts (middleware) ↻
│   ├── 🛤️ routes/prashasakah/apiKeys.ts (route) ── 5 deps
│   │   ├── 🔌 services/database.ts (service) ↻
│   │   ├── 🔧 utils/logger.ts (utility) ↻
│   │   ├── 🛡️ middleware/authenticate.ts (middleware) ↻
│   │   ├── 🛡️ middleware/requireRole.ts (middleware) ↻
│   │   └── 🛤️ routes/prashasakah/rateLimiter.ts (route) ★ leaf
│   ├── 🛤️ routes/prashasakah/auditLogs.ts (route) ── 3 deps
│   │   ├── 🔧 utils/logger.ts (utility) ↻
│   │   ├── 🛡️ middleware/authenticate.ts (middleware) ↻
│   │   └── 🛡️ middleware/requireRole.ts (middleware) ↻
│   ├── 🛤️ routes/prashasakah/config.ts (route) ── 3 deps
│   │   ├── 🔧 utils/logger.ts (utility) ↻
│   │   ├── 🛡️ middleware/authenticate.ts (middleware) ↻
│   │   └── 🛡️ middleware/requireRole.ts (middleware) ↻
│   ├── 🛤️ routes/prashasakah/health.ts (route) ── 4 deps
│   │   ├── 🔌 services/database.ts (service) ↻
│   │   ├── 🔧 utils/logger.ts (utility) ↻
│   │   ├── 🛡️ middleware/authenticate.ts (middleware) ↻
│   │   └── 🛡️ middleware/requireRole.ts (middleware) ↻
│   ├── 🛤️ routes/prashasakah/meetings.ts (route) ── 4 deps
│   │   ├── 🔌 services/database.ts (service) ↻
│   │   ├── 🔧 utils/logger.ts (utility) ↻
│   │   ├── 🛡️ middleware/authenticate.ts (middleware) ↻
│   │   └── 🛡️ middleware/requireRole.ts (middleware) ↻
│   ├── 🛤️ routes/prashasakah/rateLimiter.ts (route) ↻
│   ├── 🛤️ routes/prashasakah/rooms.ts (route) ── 5 deps
│   │   ├── 🔌 services/database.ts (service) ↻
│   │   ├── 🔧 utils/logger.ts (utility) ↻
│   │   ├── 🛡️ middleware/authenticate.ts (middleware) ↻
│   │   ├── 🛡️ middleware/requireRole.ts (middleware) ↻
│   │   └── 🛤️ routes/prashasakah/rateLimiter.ts (route) ↻
│   ├── 🛤️ routes/prashasakah/settings.ts (route) ── 3 deps
│   │   ├── 🔧 utils/logger.ts (utility) ↻
│   │   ├── 🛡️ middleware/authenticate.ts (middleware) ↻
│   │   └── 🛡️ middleware/requireRole.ts (middleware) ↻
│   ├── 🛤️ routes/prashasakah/stats.ts (route) ── 4 deps
│   │   ├── 🔌 services/database.ts (service) ↻
│   │   ├── 🔧 utils/logger.ts (utility) ↻
│   │   ├── 🛡️ middleware/authenticate.ts (middleware) ↻
│   │   └── 🛡️ middleware/requireRole.ts (middleware) ↻
│   └── 🛤️ routes/prashasakah/users.ts (route) ── 6 deps
│       ├── 🔌 services/database.ts (service) ↻
│       ├── 🔧 utils/logger.ts (utility) ↻
│       ├── 🔧 utils/validation.ts (utility) ↻
│       ├── 🛡️ middleware/authenticate.ts (middleware) ↻
│       ├── 🛡️ middleware/requireRole.ts (middleware) ↻
│       └── 🛤️ routes/prashasakah/rateLimiter.ts (route) ↻
├── 🛤️ routes/rooms.ts (route) ── 9 deps
│   ├── 🔌 services/database.ts (service) ↻
│   ├── 🔌 services/livekit.ts (service) ↻
│   ├── 🔌 services/lobbyService.ts (service) ── 2 deps
│   │   ├── 🔌 services/livekit.ts (service) ↻
│   │   └── 🔌 services/redis.ts (service) ↻
│   ├── 🔌 services/redis.ts (service) ↻
│   ├── 🔌 services/roomService.ts (service) ── 2 deps
│   │   ├── 🔌 services/database.ts (service) ↻
│   │   └── 🔧 utils/logger.ts (utility) ↻
│   ├── 🔧 utils/logger.ts (utility) ↻
│   ├── 🔧 utils/validation.ts (utility) ↻
│   ├── 🛡️ middleware/authenticate.ts (middleware) ↻
│   └── 🛡️ middleware/requireUser.ts (middleware) ↻
├── 🛤️ routes/token.ts (route) ── 7 deps
│   ├── 🔌 services/database.ts (service) ↻
│   ├── 🔌 services/livekit.ts (service) ↻
│   ├── 🔌 services/redis.ts (service) ↻
│   ├── 🔌 services/roomService.ts (service) ↻
│   ├── 🔧 utils/logger.ts (utility) ↻
│   ├── 🛡️ middleware/authenticate.ts (middleware) ↻
│   └── 🛡️ middleware/rateLimiter.ts (middleware) ↻
└── 🛤️ routes/webhook.ts (route) ── 5 deps
    ├── 🔌 services/database.ts (service) ↻
    ├── 🔌 services/livekit.ts (service) ↻
    ├── 🔌 services/redis.ts (service) ↻
    ├── 🔌 services/webhookService.ts (service) ── 3 deps
    │   ├── 🔌 services/database.ts (service) ↻
    │   ├── 🔌 services/redis.ts (service) ↻
    │   └── 🔧 utils/logger.ts (utility) ↻
    └── 🔧 utils/logger.ts (utility) ↻

Total unique files in tree: 36/38


┌─────────────────────────────────────────────
│ ⚠️  UNREACHABLE from entry point (orphans)
└─────────────────────────────────────────────
  ❌ services/alertService.ts (service) [1 deps, 0 importers] ★ orphan leaf
```
---

## Frontend — Category Tree

```
🎨 (root)/ (3 files)
├── 🎨 index.css [0↓ 1↑] ★ leaf
├── 🚀 main.tsx [2↓ 0↑] → index.css, router.tsx
└── 🔀 router.tsx [25↓ 1↑] → Layout.tsx, ProtectedRoute.tsx, ApiKeysPage.tsx, ForgotPasswordPage.tsx, HistoryPage.tsx, HomePage.tsx, LoginPage.tsx, MeetingDetailPage.tsx, NotFoundPage.tsx, PreJoinPage.tsx, RegisterPage.tsx, ResetPasswordPage.tsx, RoomPage.tsx, SchedulePage.tsx, ThankYouPage.tsx, Alerts.tsx, ApiKeys.tsx, AuditLogs.tsx, Dashboard.tsx, MeetingDetail.tsx, Meetings.tsx, PrashasakahLayout.tsx, Settings.tsx, UserDetail.tsx, Users.tsx

🧩 components/ (57 files)
├── 🧩 ErrorBoundary.tsx [1↓ 2↑] → logger.ts
├── 🧩 Layout.tsx [2↓ 1↑] → useTokenRefresh.ts, authStore.ts
├── 🧩 ProtectedRoute.tsx [1↓ 1↑] → authStore.ts
├── 🧩 ChatHeader.tsx [1↓ 2↑] → meetingRoomConfig.ts
├── 🧩 ChatInput.tsx [2↓ 2↑] → chatUtils.tsx, cn.ts
├── 🧩 ChatMessageList.tsx [4↓ 2↑] → chatUtils.tsx, meetingRoomConfig.ts, index.ts, cn.ts
├── 🧩 PollCreator.tsx [0↓ 2↑] ★ leaf
├── 🧩 chatUtils.tsx [1↓ 4↑] → security.ts
├── 🧩 index.ts [5↓ 0↑] → ChatHeader.tsx, ChatInput.tsx, ChatMessageList.tsx, PollCreator.tsx, chatUtils.tsx
├── 🧩 ControlBar.tsx [11↓ 1↑] → ControlBarButtons.tsx, meetingRoomConfig.ts, useAudioControls.ts, useMeetingActions.ts, usePictureInPicture.ts, useScreenShareControls.ts, useVideoControls.ts, api.ts, roomStore.ts, cn.ts, logger.ts
├── 🧩 ControlBarButtons.tsx [1↓ 1↑] → cn.ts
├── 🧩 QualityIndicator.tsx [4↓ 1↑] → useAdaptiveQuality.ts, useNetworkQuality.ts, roomStore.ts, logger.ts
├── 🧩 ChatPanel.tsx [10↓ 1↑] → ChatHeader.tsx, ChatInput.tsx, ChatMessageList.tsx, PollCreator.tsx, chatUtils.tsx, meetingRoomConfig.ts, api.ts, roomStore.ts, index.ts, logger.ts
├── 🧩 ParticipantListItem.tsx [1↓ 1↑] → meetingRoomConfig.ts
├── 🧩 ParticipantsPanel.tsx [7↓ 1↑] → ParticipantListItem.tsx, meetingRoomConfig.ts, useParticipantActions.ts, api.ts, roomStore.ts, api.ts, logger.ts
├── 🧩 SettingsPanel.tsx [4↓ 1↑] → meetingRoomConfig.ts, api.ts, roomStore.ts, logger.ts
├── 🧩 PiPContainer.tsx [5↓ 2↑] → PiPControls.tsx, PiPScreenShare.tsx, PiPVideoGrid.tsx, roomStore.ts, logger.ts
├── 🧩 PiPControls.tsx [2↓ 2↑] → cn.ts, logger.ts
├── 🧩 PiPScreenShare.tsx [0↓ 2↑] ★ leaf
├── 🧩 PiPVideoGrid.tsx [1↓ 2↑] → roomStore.ts
├── 🧩 index.ts [5↓ 1↑] → PiPContainer.tsx, PiPControls.tsx, PiPScreenShare.tsx, PiPVideoGrid.tsx, index.ts
├── 🧩 pip.css [0↓ 0↑] ★ leaf
├── 🧩 AdminApiKeyManager.tsx [3↓ 1↑] → prashasakahApi.ts, authStore.ts, logger.ts
├── 🧩 AlertList.tsx [1↓ 1↑] → prashasakahApi.ts
├── 🧩 AuditLogTable.tsx [1↓ 1↑] → prashasakahApi.ts
├── 🧩 BandwidthChart.tsx [0↓ 2↑] ★ leaf
├── 🧩 ChangePasswordModal.tsx [2↓ 1↑] → prashasakahApi.ts, logger.ts
├── 🧩 DateRangeFilter.tsx [0↓ 3↑] ★ leaf
├── 🧩 PeakUsersChart.tsx [0↓ 2↑] ★ leaf
├── 🧩 SettingsSection.tsx [0↓ 0↑] ★ leaf
├── 🧩 StatCard.tsx [2↓ 2↑] → Skeletons.tsx, cn.ts
├── 🧩 UserActivityLog.tsx [0↓ 1↑] ★ leaf
├── 🧩 UserEditModal.tsx [1↓ 2↑] → prashasakahApi.ts
├── 🧩 UserTable.tsx [1↓ 1↑] → prashasakahApi.ts
├── 🧩 index.ts [4↓ 0↑] → BandwidthChart.tsx, DateRangeFilter.tsx, PeakUsersChart.tsx, StatCard.tsx
├── 🧩 AudioSettings.tsx [1↓ 1↑] → types.ts
├── 🧩 CreateMeetingForm.tsx [0↓ 0↑] ★ leaf
├── 🧩 CreateMeetingModal.tsx [2↓ 0↑] → SchedulePage.tsx, cn.ts
├── 🧩 DeviceSettings.tsx [1↓ 1↑] → types.ts
├── 🧩 JoinForm.tsx [1↓ 0↑] → index.ts
├── 🧩 PreJoinControls.tsx [2↓ 1↑] → types.ts, cn.ts
├── 🧩 VideoSettings.tsx [2↓ 1↑] → types.ts, cn.ts
├── 🧩 index.ts [5↓ 2↑] → AudioSettings.tsx, DeviceSettings.tsx, PreJoinControls.tsx, VideoSettings.tsx, types.ts
├── 🧩 types.ts [1↓ 5↑] → roomStore.ts
├── 🧩 ConferenceRoom.tsx [17↓ 1↑] → ControlBar.tsx, QualityIndicator.tsx, ChatPanel.tsx, ParticipantsPanel.tsx, SettingsPanel.tsx, PiPContainer.tsx, GridLayout.tsx, ScreenShareLayout.tsx, SpeakerLayout.tsx, meetingRoomConfig.ts, ParticipantVisibilityContext.tsx, useDataChannelHandler.tsx, useJoinLeaveSounds.ts, useQualityMonitoring.ts, roomStore.ts, blurProcessorManager.ts, logger.ts
├── 🧩 GridLayout.tsx [3↓ 1↑] → ParticipantTile.tsx, useAdmittedParticipants.ts, roomStore.ts
├── 🧩 LobbyWaiting.tsx [1↓ 1↑] → logger.ts
├── 🧩 ParticipantTile.tsx [4↓ 3↑] → meetingRoomConfig.ts, ParticipantVisibilityContext.tsx, roomStore.ts, logger.ts
├── 🧩 ScreenShareLayout.tsx [1↓ 1↑] → ParticipantTile.tsx
├── 🧩 SpeakerLayout.tsx [3↓ 1↑] → ParticipantTile.tsx, useAdmittedParticipants.ts, roomStore.ts
├── 🧩 MeetingFormModal.tsx [2↓ 1↑] → index.ts, cn.ts
├── 🧩 ApiKeyManager.tsx [3↓ 1↑] → apiKeysApi.ts, authStore.ts, logger.ts
├── 🧩 DashboardCalendar.tsx [3↓ 1↑] → Skeletons.tsx, index.ts, cn.ts
├── 🧩 DashboardStats.tsx [2↓ 2↑] → Skeletons.tsx, cn.ts
├── 🧩 PageErrorBoundary.tsx [1↓ 5↑] → ErrorBoundary.tsx
├── 🧩 Skeletons.tsx [1↓ 7↑] → cn.ts
└── 🧩 index.ts [4↓ 0↑] → DashboardCalendar.tsx, DashboardStats.tsx, PageErrorBoundary.tsx, Skeletons.tsx

⚙️ config/ (1 files)
└── ⚙️ meetingRoomConfig.ts [1↓ 21↑] → logger.ts

🔄 contexts/ (1 files)
└── 🔄 ParticipantVisibilityContext.tsx [4↓ 2↑] → meetingRoomConfig.ts, useTabVisibility.ts, useVideoPool.ts, useVisibleParticipants.ts

🪝 hooks/ (31 files)
├── 🪝 useAdaptiveQuality.ts [2↓ 1↑] → useCallSizeConfig.ts, useNetworkQuality.ts
├── 🪝 useAdmittedParticipants.ts [1↓ 2↑] → logger.ts
├── 🪝 useAudioControls.ts [2↓ 1↑] → meetingRoomConfig.ts, logger.ts
├── 🪝 useAutoPiP.ts [1↓ 0↑] → logger.ts
├── 🪝 useCallSizeConfig.ts [1↓ 1↑] → meetingRoomConfig.ts
├── 🪝 useCpuMonitor.ts [3↓ 0↑] → meetingRoomConfig.ts, useFpsMonitor.ts, logger.ts
├── 🪝 useDataChannelHandler.tsx [2↓ 1↑] → roomStore.ts, index.ts
├── 🪝 useFormValidation.ts [0↓ 3↑] ★ leaf
├── 🪝 useFpsMonitor.ts [0↓ 1↑] ★ leaf
├── 🪝 useJoinLeaveSounds.ts [0↓ 1↑] ★ leaf
├── 🪝 useLeaveMeeting.ts [2↓ 0↑] → api.ts, logger.ts
├── 🪝 useLightweightVideoFilter.ts [1↓ 1↑] → logger.ts
├── 🪝 useLobbyManager.ts [0↓ 0↑] ★ leaf
├── 🪝 useMediaSync.ts [2↓ 0↑] → meetingRoomConfig.ts, logger.ts
├── 🪝 useMeetingActions.ts [3↓ 1↑] → api.ts, roomStore.ts, logger.ts
├── 🪝 useNetworkQuality.ts [1↓ 2↑] → logger.ts
├── 🪝 useParticipantActions.ts [2↓ 1↑] → api.ts, logger.ts
├── 🪝 usePermissionEnforcer.ts [2↓ 0↑] → RoomPage.tsx, logger.ts
├── 🪝 usePictureInPicture.ts [1↓ 1↑] → logger.ts
├── 🪝 usePreJoinAuth.ts [4↓ 1↑] → api.ts, authStore.ts, index.ts, logger.ts
├── 🪝 usePreJoinMedia.ts [6↓ 1↑] → index.ts, meetingRoomConfig.ts, roomStore.ts, blurProcessorManager.ts, cameraCapabilities.ts, logger.ts
├── 🪝 useQualityMonitoring.ts [2↓ 1↑] → meetingRoomConfig.ts, roomStore.ts
├── 🪝 useRequireRole.ts [2↓ 0↑] → authStore.ts, index.ts
├── 🪝 useScreenShareControls.ts [2↓ 1↑] → meetingRoomConfig.ts, logger.ts
├── 🪝 useSettingsSync.ts [1↓ 0↑] → logger.ts
├── 🪝 useSpeakerManager.ts [1↓ 0↑] → logger.ts
├── 🪝 useTabVisibility.ts [0↓ 1↑] ★ leaf
├── 🪝 useTokenRefresh.ts [4↓ 1↑] → api.ts, authStore.ts, logger.ts, security.ts
├── 🪝 useVideoControls.ts [3↓ 1↑] → meetingRoomConfig.ts, roomStore.ts, logger.ts
├── 🪝 useVideoPool.ts [1↓ 1↑] → logger.ts
└── 🪝 useVisibleParticipants.ts [0↓ 1↑] ★ leaf

📄 pages/ (23 files)
├── 📄 ApiKeysPage.tsx [2↓ 1↑] → ApiKeyManager.tsx, authStore.ts
├── 📄 ForgotPasswordPage.tsx [3↓ 1↑] → useFormValidation.ts, api.ts, cn.ts
├── 📄 HistoryPage.tsx [7↓ 1↑] → PageErrorBoundary.tsx, Skeletons.tsx, api.ts, index.ts, cn.ts, logger.ts, security.ts
├── 📄 HomePage.tsx [9↓ 1↑] → DashboardStats.tsx, PageErrorBoundary.tsx, Skeletons.tsx, api.ts, authStore.ts, index.ts, cn.ts, logger.ts, roomName.ts
├── 📄 LoginPage.tsx [4↓ 1↑] → useFormValidation.ts, api.ts, authStore.ts, cn.ts
├── 📄 MeetingDetailPage.tsx [7↓ 1↑] → PageErrorBoundary.tsx, Skeletons.tsx, api.ts, index.ts, cn.ts, logger.ts, security.ts
├── 📄 NotFoundPage.tsx [0↓ 1↑] ★ leaf
├── 📄 PreJoinPage.tsx [9↓ 1↑] → index.ts, meetingRoomConfig.ts, useLightweightVideoFilter.ts, usePreJoinAuth.ts, usePreJoinMedia.ts, api.ts, cn.ts, roomName.ts, security.ts
├── 📄 RegisterPage.tsx [4↓ 1↑] → useFormValidation.ts, api.ts, authStore.ts, cn.ts
├── 📄 ResetPasswordPage.tsx [2↓ 1↑] → api.ts, cn.ts
├── 📄 RoomPage.tsx [8↓ 2↑] → ErrorBoundary.tsx, ConferenceRoom.tsx, LobbyWaiting.tsx, meetingRoomConfig.ts, api.ts, roomStore.ts, blurProcessorManager.ts, logger.ts
├── 📄 SchedulePage.tsx [7↓ 2↑] → MeetingFormModal.tsx, PageErrorBoundary.tsx, api.ts, index.ts, cn.ts, logger.ts, timezone.ts
├── 📄 ThankYouPage.tsx [1↓ 1↑] → authStore.ts
├── 📄 Alerts.tsx [3↓ 1↑] → AlertList.tsx, prashasakahApi.ts, logger.ts
├── 📄 ApiKeys.tsx [1↓ 1↑] → AdminApiKeyManager.tsx
├── 📄 AuditLogs.tsx [3↓ 1↑] → AuditLogTable.tsx, prashasakahApi.ts, logger.ts
├── 📄 Dashboard.tsx [7↓ 1↑] → BandwidthChart.tsx, DateRangeFilter.tsx, PeakUsersChart.tsx, StatCard.tsx, prashasakahApi.ts, authStore.ts, logger.ts
├── 📄 MeetingDetail.tsx [3↓ 1↑] → prashasakahApi.ts, logger.ts, security.ts
├── 📄 Meetings.tsx [3↓ 1↑] → DateRangeFilter.tsx, prashasakahApi.ts, logger.ts
├── 📄 PrashasakahLayout.tsx [1↓ 1↑] → authStore.ts
├── 📄 Settings.tsx [3↓ 1↑] → prashasakahApi.ts, authStore.ts, logger.ts
├── 📄 UserDetail.tsx [6↓ 1↑] → ChangePasswordModal.tsx, UserActivityLog.tsx, UserEditModal.tsx, prashasakahApi.ts, authStore.ts, logger.ts
└── 📄 Users.tsx [5↓ 1↑] → UserEditModal.tsx, UserTable.tsx, prashasakahApi.ts, authStore.ts, logger.ts

🔌 services/ (4 files)
├── 🔌 PiPWindowManager.ts [1↓ 0↑] → logger.ts
├── 🔌 api.ts [3↓ 22↑] → api.ts, index.ts, security.ts
├── 🔌 apiKeysApi.ts [1↓ 1↑] → api.ts
└── 🔌 prashasakahApi.ts [1↓ 14↑] → api.ts

📦 store/ (3 files)
├── 📦 authStore.ts [4↓ 17↑] → api.ts, index.ts, logger.ts, security.ts
├── 📦 pipStore.ts [0↓ 0↑] ★ leaf
└── 📦 roomStore.ts [2↓ 18↑] → meetingRoomConfig.ts, index.ts

🔤 types/ (4 files)
├── 🔤 api.ts [1↓ 3↑] → index.ts
├── 🔤 index.ts [3↓ 16↑] → api.ts, participant.ts, room.ts
├── 🔤 participant.ts [0↓ 1↑] ★ leaf
└── 🔤 room.ts [0↓ 1↑] ★ leaf

🔧 utils/ (8 files)
├── 🔧 blurProcessorManager.ts [1↓ 3↑] → logger.ts
├── 🔧 cameraCapabilities.ts [1↓ 1↑] → logger.ts
├── 🔧 cn.ts [0↓ 22↑] ★ leaf
├── 🔧 date.ts [0↓ 0↑] ★ leaf
├── 🔧 logger.ts [0↓ 52↑] ★ leaf
├── 🔧 roomName.ts [0↓ 2↑] ★ leaf
├── 🔧 security.ts [0↓ 8↑] ★ leaf
└── 🔧 timezone.ts [0↓ 1↑] ★ leaf

```
---

## Backend — Category Tree

```
⚙️ (root)/ (2 files)
├── ⚙️ config.ts [1↓ 7↑] → logger.ts
└── 🚀 index.ts [15↓ 0↑] → auth.ts, token.ts, rooms.ts, meetings.ts, egress.ts, webhook.ts, index.ts, apiKeys.ts, external.ts, database.ts, redis.ts, config.ts, rateLimiter.ts, requestId.ts, logger.ts

🛡️ middleware/ (5 files)
├── 🛡️ authenticate.ts [4↓ 20↑] → config.ts, database.ts, redis.ts, logger.ts
├── 🛡️ rateLimiter.ts [0↓ 3↑] ★ leaf
├── 🛡️ requestId.ts [0↓ 1↑] ★ leaf
├── 🛡️ requireRole.ts [1↓ 11↑] → authenticate.ts
└── 🛡️ requireUser.ts [1↓ 2↑] → authenticate.ts

🛤️ routes/ (20 files)
├── 🛤️ apiKeys.ts [4↓ 1↑] → database.ts, authenticate.ts, requireRole.ts, logger.ts
├── 🛤️ auth.ts [7↓ 1↑] → config.ts, database.ts, authenticate.ts, rateLimiter.ts, redis.ts, validation.ts, logger.ts
├── 🛤️ egress.ts [5↓ 1↑] → authenticate.ts, livekit.ts, database.ts, config.ts, logger.ts
├── 🛤️ external.ts [3↓ 1↑] → database.ts, logger.ts, authenticate.ts
├── 🛤️ meetings.ts [7↓ 1↑] → authenticate.ts, requireUser.ts, database.ts, meetingService.ts, meetings.ts, validation.ts, logger.ts
├── 🛤️ alerts.ts [4↓ 1↑] → authenticate.ts, requireRole.ts, database.ts, logger.ts
├── 🛤️ apiKeys.ts [5↓ 1↑] → requireRole.ts, authenticate.ts, database.ts, logger.ts, rateLimiter.ts
├── 🛤️ auditLogs.ts [3↓ 1↑] → requireRole.ts, authenticate.ts, logger.ts
├── 🛤️ config.ts [3↓ 1↑] → authenticate.ts, requireRole.ts, logger.ts
├── 🛤️ health.ts [4↓ 1↑] → authenticate.ts, requireRole.ts, database.ts, logger.ts
├── 🛤️ index.ts [12↓ 1↑] → authenticate.ts, rateLimiter.ts, stats.ts, health.ts, config.ts, users.ts, rooms.ts, meetings.ts, alerts.ts, auditLogs.ts, settings.ts, apiKeys.ts
├── 🛤️ meetings.ts [4↓ 1↑] → authenticate.ts, requireRole.ts, database.ts, logger.ts
├── 🛤️ rateLimiter.ts [0↓ 4↑] ★ leaf
├── 🛤️ rooms.ts [5↓ 1↑] → authenticate.ts, requireRole.ts, database.ts, logger.ts, rateLimiter.ts
├── 🛤️ settings.ts [3↓ 1↑] → requireRole.ts, authenticate.ts, logger.ts
├── 🛤️ stats.ts [4↓ 1↑] → authenticate.ts, requireRole.ts, database.ts, logger.ts
├── 🛤️ users.ts [6↓ 1↑] → authenticate.ts, requireRole.ts, database.ts, validation.ts, logger.ts, rateLimiter.ts
├── 🛤️ rooms.ts [9↓ 1↑] → authenticate.ts, requireUser.ts, livekit.ts, redis.ts, lobbyService.ts, validation.ts, logger.ts, database.ts, roomService.ts
├── 🛤️ token.ts [7↓ 1↑] → authenticate.ts, rateLimiter.ts, livekit.ts, database.ts, roomService.ts, redis.ts, logger.ts
└── 🛤️ webhook.ts [5↓ 1↑] → livekit.ts, database.ts, redis.ts, webhookService.ts, logger.ts

📋 schemas/ (1 files)
└── 📋 meetings.ts [0↓ 1↑] ★ leaf

🔌 services/ (8 files)
├── 🔌 alertService.ts [1↓ 0↑] → database.ts
├── 🔌 database.ts [2↓ 21↑] → config.ts, logger.ts
├── 🔌 livekit.ts [2↓ 5↑] → config.ts, logger.ts
├── 🔌 lobbyService.ts [2↓ 1↑] → livekit.ts, redis.ts
├── 🔌 meetingService.ts [1↓ 1↑] → database.ts
├── 🔌 redis.ts [2↓ 8↑] → config.ts, logger.ts
├── 🔌 roomService.ts [2↓ 2↑] → database.ts, logger.ts
└── 🔌 webhookService.ts [3↓ 1↑] → database.ts, redis.ts, logger.ts

🔧 utils/ (2 files)
├── 🔧 logger.ts [0↓ 26↑] ★ leaf
└── 🔧 validation.ts [0↓ 4↑] ★ leaf

```
---

## Frontend — Reverse Dependency Tree

_Who imports this file? → Who imports THOSE? → ..._

```
🔧 utils/logger.ts (util) ← 52 importers
├── 🧩 components/ErrorBoundary.tsx (component) ← 2
│   ├── 🧩 components/shared/PageErrorBoundary.tsx (component)
│   └── 📄 pages/RoomPage.tsx (page)
├── 🧩 components/controls/ControlBar.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/controls/QualityIndicator.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/panels/ChatPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/panels/ParticipantsPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/panels/SettingsPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/pip/PiPContainer.tsx (component) ← 2
│   ├── 🧩 components/pip/index.ts (component)
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/pip/PiPControls.tsx (component) ← 2
│   ├── 🧩 components/pip/PiPContainer.tsx (component)
│   └── 🧩 components/pip/index.ts (component)
├── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component) ← 1
│   └── 📄 pages/prashasakah/ApiKeys.tsx (page)
├── 🧩 components/prashasakah/ChangePasswordModal.tsx (component) ← 1
│   └── 📄 pages/prashasakah/UserDetail.tsx (page)
├── 🧩 components/room/ConferenceRoom.tsx (component) ← 1
│   └── 📄 pages/RoomPage.tsx (page)
├── 🧩 components/room/LobbyWaiting.tsx (component) ← 1
│   └── 📄 pages/RoomPage.tsx (page)
├── 🧩 components/room/ParticipantTile.tsx (component) ← 3
│   ├── 🧩 components/room/GridLayout.tsx (component)
│   ├── 🧩 components/room/ScreenShareLayout.tsx (component)
│   └── 🧩 components/room/SpeakerLayout.tsx (component)
├── 🧩 components/settings/ApiKeyManager.tsx (component) ← 1
│   └── 📄 pages/ApiKeysPage.tsx (page)
├── ⚙️ config/meetingRoomConfig.ts (config) ← 21
│   ├── 🧩 components/chat/ChatHeader.tsx (component)
│   ├── 🧩 components/chat/ChatMessageList.tsx (component)
│   ├── 🧩 components/controls/ControlBar.tsx (component)
│   └── 🧩 components/panels/ChatPanel.tsx (component)
│       ... +17 more
├── 🪝 hooks/useAdmittedParticipants.ts (hook) ← 2
│   ├── 🧩 components/room/GridLayout.tsx (component)
│   └── 🧩 components/room/SpeakerLayout.tsx (component)
├── 🪝 hooks/useAudioControls.ts (hook) ← 1
│   └── 🧩 components/controls/ControlBar.tsx (component)
├── 🪝 hooks/useAutoPiP.ts (hook)
├── 🪝 hooks/useCpuMonitor.ts (hook)
├── 🪝 hooks/useLeaveMeeting.ts (hook)
├── 🪝 hooks/useLightweightVideoFilter.ts (hook) ← 1
│   └── 📄 pages/PreJoinPage.tsx (page)
├── 🪝 hooks/useMediaSync.ts (hook)
├── 🪝 hooks/useMeetingActions.ts (hook) ← 1
│   └── 🧩 components/controls/ControlBar.tsx (component)
├── 🪝 hooks/useNetworkQuality.ts (hook) ← 2
│   ├── 🧩 components/controls/QualityIndicator.tsx (component)
│   └── 🪝 hooks/useAdaptiveQuality.ts (hook)
├── 🪝 hooks/useParticipantActions.ts (hook) ← 1
│   └── 🧩 components/panels/ParticipantsPanel.tsx (component)
├── 🪝 hooks/usePermissionEnforcer.ts (hook)
├── 🪝 hooks/usePictureInPicture.ts (hook) ← 1
│   └── 🧩 components/controls/ControlBar.tsx (component)
├── 🪝 hooks/usePreJoinAuth.ts (hook) ← 1
│   └── 📄 pages/PreJoinPage.tsx (page)
├── 🪝 hooks/usePreJoinMedia.ts (hook) ← 1
│   └── 📄 pages/PreJoinPage.tsx (page)
├── 🪝 hooks/useScreenShareControls.ts (hook) ← 1
│   └── 🧩 components/controls/ControlBar.tsx (component)
├── 🪝 hooks/useSettingsSync.ts (hook)
├── 🪝 hooks/useSpeakerManager.ts (hook)
├── 🪝 hooks/useTokenRefresh.ts (hook) ← 1
│   └── 🧩 components/Layout.tsx (component)
├── 🪝 hooks/useVideoControls.ts (hook) ← 1
│   └── 🧩 components/controls/ControlBar.tsx (component)
├── 🪝 hooks/useVideoPool.ts (hook) ← 1
│   └── 🔄 contexts/ParticipantVisibilityContext.tsx (context)
├── 📄 pages/HistoryPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/HomePage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/MeetingDetailPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/RoomPage.tsx (page) ← 2
│   ├── 🪝 hooks/usePermissionEnforcer.ts (hook)
│   └── 🔀 router.tsx (router)
├── 📄 pages/SchedulePage.tsx (page) ← 2
│   ├── 🧩 components/prejoin/CreateMeetingModal.tsx (component)
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/Alerts.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/AuditLogs.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/Dashboard.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/MeetingDetail.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/Meetings.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/Settings.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/UserDetail.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/Users.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 🔌 services/PiPWindowManager.ts (service)
├── 📦 store/authStore.ts (store) ← 17
│   ├── 🧩 components/Layout.tsx (component)
│   ├── 🧩 components/ProtectedRoute.tsx (component)
│   ├── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component)
│   └── 🧩 components/settings/ApiKeyManager.tsx (component)
│       ... +13 more
├── 🔧 utils/blurProcessorManager.ts (util) ← 3
│   ├── 🧩 components/room/ConferenceRoom.tsx (component)
│   ├── 🪝 hooks/usePreJoinMedia.ts (hook)
│   └── 📄 pages/RoomPage.tsx (page)
└── 🔧 utils/cameraCapabilities.ts (util) ← 1
    └── 🪝 hooks/usePreJoinMedia.ts (hook)

🔌 services/api.ts (service) ← 22 importers
├── 🧩 components/controls/ControlBar.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/panels/ChatPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/panels/ParticipantsPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/panels/SettingsPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🪝 hooks/useLeaveMeeting.ts (hook)
├── 🪝 hooks/useMeetingActions.ts (hook) ← 1
│   └── 🧩 components/controls/ControlBar.tsx (component)
├── 🪝 hooks/useParticipantActions.ts (hook) ← 1
│   └── 🧩 components/panels/ParticipantsPanel.tsx (component)
├── 🪝 hooks/usePreJoinAuth.ts (hook) ← 1
│   └── 📄 pages/PreJoinPage.tsx (page)
├── 🪝 hooks/useTokenRefresh.ts (hook) ← 1
│   └── 🧩 components/Layout.tsx (component)
├── 📄 pages/ForgotPasswordPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/HistoryPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/HomePage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/LoginPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/MeetingDetailPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/PreJoinPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/RegisterPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/ResetPasswordPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/RoomPage.tsx (page) ← 2
│   ├── 🪝 hooks/usePermissionEnforcer.ts (hook)
│   └── 🔀 router.tsx (router)
├── 📄 pages/SchedulePage.tsx (page) ← 2
│   ├── 🧩 components/prejoin/CreateMeetingModal.tsx (component)
│   └── 🔀 router.tsx (router)
├── 🔌 services/apiKeysApi.ts (service) ← 1
│   └── 🧩 components/settings/ApiKeyManager.tsx (component)
├── 🔌 services/prashasakahApi.ts (service) ← 14
│   ├── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component)
│   ├── 🧩 components/prashasakah/AlertList.tsx (component)
│   ├── 🧩 components/prashasakah/AuditLogTable.tsx (component)
│   └── 🧩 components/prashasakah/ChangePasswordModal.tsx (component)
│       ... +10 more
└── 📦 store/authStore.ts (store) ← 17
    ├── 🧩 components/Layout.tsx (component)
    ├── 🧩 components/ProtectedRoute.tsx (component)
    ├── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component)
    └── 🧩 components/settings/ApiKeyManager.tsx (component)
        ... +13 more

🔧 utils/cn.ts (util) ← 22 importers
├── 🧩 components/chat/ChatInput.tsx (component) ← 2
│   ├── 🧩 components/chat/index.ts (component)
│   └── 🧩 components/panels/ChatPanel.tsx (component)
├── 🧩 components/chat/ChatMessageList.tsx (component) ← 2
│   ├── 🧩 components/chat/index.ts (component)
│   └── 🧩 components/panels/ChatPanel.tsx (component)
├── 🧩 components/controls/ControlBar.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/controls/ControlBarButtons.tsx (component) ← 1
│   └── 🧩 components/controls/ControlBar.tsx (component)
├── 🧩 components/pip/PiPControls.tsx (component) ← 2
│   ├── 🧩 components/pip/PiPContainer.tsx (component)
│   └── 🧩 components/pip/index.ts (component)
├── 🧩 components/prashasakah/StatCard.tsx (component) ← 2
│   ├── 🧩 components/prashasakah/index.ts (component)
│   └── 📄 pages/prashasakah/Dashboard.tsx (page)
├── 🧩 components/prejoin/CreateMeetingModal.tsx (component)
├── 🧩 components/prejoin/PreJoinControls.tsx (component) ← 1
│   └── 🧩 components/prejoin/index.ts (component)
├── 🧩 components/prejoin/VideoSettings.tsx (component) ← 1
│   └── 🧩 components/prejoin/index.ts (component)
├── 🧩 components/schedule/MeetingFormModal.tsx (component) ← 1
│   └── 📄 pages/SchedulePage.tsx (page)
├── 🧩 components/shared/DashboardCalendar.tsx (component) ← 1
│   └── 🧩 components/shared/index.ts (component)
├── 🧩 components/shared/DashboardStats.tsx (component) ← 2
│   ├── 🧩 components/shared/index.ts (component)
│   └── 📄 pages/HomePage.tsx (page)
├── 🧩 components/shared/Skeletons.tsx (component) ← 7
│   ├── 🧩 components/prashasakah/StatCard.tsx (component)
│   ├── 🧩 components/shared/DashboardCalendar.tsx (component)
│   ├── 🧩 components/shared/DashboardStats.tsx (component)
│   └── 🧩 components/shared/index.ts (component)
│       ... +3 more
├── 📄 pages/ForgotPasswordPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/HistoryPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/HomePage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/LoginPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/MeetingDetailPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/PreJoinPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/RegisterPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/ResetPasswordPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
└── 📄 pages/SchedulePage.tsx (page) ← 2
    ├── 🧩 components/prejoin/CreateMeetingModal.tsx (component)
    └── 🔀 router.tsx (router)

⚙️ config/meetingRoomConfig.ts (config) ← 21 importers
├── 🧩 components/chat/ChatHeader.tsx (component) ← 2
│   ├── 🧩 components/chat/index.ts (component)
│   └── 🧩 components/panels/ChatPanel.tsx (component)
├── 🧩 components/chat/ChatMessageList.tsx (component) ← 2
│   ├── 🧩 components/chat/index.ts (component)
│   └── 🧩 components/panels/ChatPanel.tsx (component)
├── 🧩 components/controls/ControlBar.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/panels/ChatPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/panels/ParticipantListItem.tsx (component) ← 1
│   └── 🧩 components/panels/ParticipantsPanel.tsx (component)
├── 🧩 components/panels/ParticipantsPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/panels/SettingsPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/room/ConferenceRoom.tsx (component) ← 1
│   └── 📄 pages/RoomPage.tsx (page)
├── 🧩 components/room/ParticipantTile.tsx (component) ← 3
│   ├── 🧩 components/room/GridLayout.tsx (component)
│   ├── 🧩 components/room/ScreenShareLayout.tsx (component)
│   └── 🧩 components/room/SpeakerLayout.tsx (component)
├── 🔄 contexts/ParticipantVisibilityContext.tsx (context) ← 2
│   ├── 🧩 components/room/ConferenceRoom.tsx (component)
│   └── 🧩 components/room/ParticipantTile.tsx (component)
├── 🪝 hooks/useAudioControls.ts (hook) ← 1
│   └── 🧩 components/controls/ControlBar.tsx (component)
├── 🪝 hooks/useCallSizeConfig.ts (hook) ← 1
│   └── 🪝 hooks/useAdaptiveQuality.ts (hook)
├── 🪝 hooks/useCpuMonitor.ts (hook)
├── 🪝 hooks/useMediaSync.ts (hook)
├── 🪝 hooks/usePreJoinMedia.ts (hook) ← 1
│   └── 📄 pages/PreJoinPage.tsx (page)
├── 🪝 hooks/useQualityMonitoring.ts (hook) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🪝 hooks/useScreenShareControls.ts (hook) ← 1
│   └── 🧩 components/controls/ControlBar.tsx (component)
├── 🪝 hooks/useVideoControls.ts (hook) ← 1
│   └── 🧩 components/controls/ControlBar.tsx (component)
├── 📄 pages/PreJoinPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/RoomPage.tsx (page) ← 2
│   ├── 🪝 hooks/usePermissionEnforcer.ts (hook)
│   └── 🔀 router.tsx (router)
└── 📦 store/roomStore.ts (store) ← 18
    ├── 🧩 components/controls/ControlBar.tsx (component)
    ├── 🧩 components/controls/QualityIndicator.tsx (component)
    ├── 🧩 components/panels/ChatPanel.tsx (component)
    └── 🧩 components/panels/ParticipantsPanel.tsx (component)
        ... +14 more

📦 store/roomStore.ts (store) ← 18 importers
├── 🧩 components/controls/ControlBar.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/controls/QualityIndicator.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/panels/ChatPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/panels/ParticipantsPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/panels/SettingsPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/pip/PiPContainer.tsx (component) ← 2
│   ├── 🧩 components/pip/index.ts (component)
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/pip/PiPVideoGrid.tsx (component) ← 2
│   ├── 🧩 components/pip/PiPContainer.tsx (component)
│   └── 🧩 components/pip/index.ts (component)
├── 🧩 components/prejoin/types.ts (component) ← 5
│   ├── 🧩 components/prejoin/AudioSettings.tsx (component)
│   ├── 🧩 components/prejoin/DeviceSettings.tsx (component)
│   ├── 🧩 components/prejoin/PreJoinControls.tsx (component)
│   └── 🧩 components/prejoin/VideoSettings.tsx (component)
│       ... +1 more
├── 🧩 components/room/ConferenceRoom.tsx (component) ← 1
│   └── 📄 pages/RoomPage.tsx (page)
├── 🧩 components/room/GridLayout.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/room/ParticipantTile.tsx (component) ← 3
│   ├── 🧩 components/room/GridLayout.tsx (component)
│   ├── 🧩 components/room/ScreenShareLayout.tsx (component)
│   └── 🧩 components/room/SpeakerLayout.tsx (component)
├── 🧩 components/room/SpeakerLayout.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🪝 hooks/useDataChannelHandler.tsx (hook) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🪝 hooks/useMeetingActions.ts (hook) ← 1
│   └── 🧩 components/controls/ControlBar.tsx (component)
├── 🪝 hooks/usePreJoinMedia.ts (hook) ← 1
│   └── 📄 pages/PreJoinPage.tsx (page)
├── 🪝 hooks/useQualityMonitoring.ts (hook) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🪝 hooks/useVideoControls.ts (hook) ← 1
│   └── 🧩 components/controls/ControlBar.tsx (component)
└── 📄 pages/RoomPage.tsx (page) ← 2
    ├── 🪝 hooks/usePermissionEnforcer.ts (hook)
    └── 🔀 router.tsx (router)

📦 store/authStore.ts (store) ← 17 importers
├── 🧩 components/Layout.tsx (component) ← 1
│   └── 🔀 router.tsx (router)
├── 🧩 components/ProtectedRoute.tsx (component) ← 1
│   └── 🔀 router.tsx (router)
├── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component) ← 1
│   └── 📄 pages/prashasakah/ApiKeys.tsx (page)
├── 🧩 components/settings/ApiKeyManager.tsx (component) ← 1
│   └── 📄 pages/ApiKeysPage.tsx (page)
├── 🪝 hooks/usePreJoinAuth.ts (hook) ← 1
│   └── 📄 pages/PreJoinPage.tsx (page)
├── 🪝 hooks/useRequireRole.ts (hook)
├── 🪝 hooks/useTokenRefresh.ts (hook) ← 1
│   └── 🧩 components/Layout.tsx (component)
├── 📄 pages/ApiKeysPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/HomePage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/LoginPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/RegisterPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/ThankYouPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/Dashboard.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/PrashasakahLayout.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/Settings.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/UserDetail.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
└── 📄 pages/prashasakah/Users.tsx (page) ← 1
    └── 🔀 router.tsx (router)

🔤 types/index.ts (type) ← 16 importers
├── 🧩 components/chat/ChatMessageList.tsx (component) ← 2
│   ├── 🧩 components/chat/index.ts (component)
│   └── 🧩 components/panels/ChatPanel.tsx (component)
├── 🧩 components/panels/ChatPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/prejoin/JoinForm.tsx (component)
├── 🧩 components/schedule/MeetingFormModal.tsx (component) ← 1
│   └── 📄 pages/SchedulePage.tsx (page)
├── 🧩 components/shared/DashboardCalendar.tsx (component) ← 1
│   └── 🧩 components/shared/index.ts (component)
├── 🪝 hooks/useDataChannelHandler.tsx (hook) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🪝 hooks/usePreJoinAuth.ts (hook) ← 1
│   └── 📄 pages/PreJoinPage.tsx (page)
├── 🪝 hooks/useRequireRole.ts (hook)
├── 📄 pages/HistoryPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/HomePage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/MeetingDetailPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/SchedulePage.tsx (page) ← 2
│   ├── 🧩 components/prejoin/CreateMeetingModal.tsx (component)
│   └── 🔀 router.tsx (router)
├── 🔌 services/api.ts (service) ← 22
│   ├── 🧩 components/controls/ControlBar.tsx (component)
│   ├── 🧩 components/panels/ChatPanel.tsx (component)
│   ├── 🧩 components/panels/ParticipantsPanel.tsx (component)
│   └── 🧩 components/panels/SettingsPanel.tsx (component)
│       ... +18 more
├── 📦 store/authStore.ts (store) ← 17
│   ├── 🧩 components/Layout.tsx (component)
│   ├── 🧩 components/ProtectedRoute.tsx (component)
│   ├── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component)
│   └── 🧩 components/settings/ApiKeyManager.tsx (component)
│       ... +13 more
├── 📦 store/roomStore.ts (store) ← 18
│   ├── 🧩 components/controls/ControlBar.tsx (component)
│   ├── 🧩 components/controls/QualityIndicator.tsx (component)
│   ├── 🧩 components/panels/ChatPanel.tsx (component)
│   └── 🧩 components/panels/ParticipantsPanel.tsx (component)
│       ... +14 more
└── 🔤 types/api.ts (type) ← 3
    ├── 🧩 components/panels/ParticipantsPanel.tsx (component)
    ├── 🔌 services/api.ts (service)
    └── 🔤 types/index.ts (type)

🔌 services/prashasakahApi.ts (service) ← 14 importers
├── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component) ← 1
│   └── 📄 pages/prashasakah/ApiKeys.tsx (page)
├── 🧩 components/prashasakah/AlertList.tsx (component) ← 1
│   └── 📄 pages/prashasakah/Alerts.tsx (page)
├── 🧩 components/prashasakah/AuditLogTable.tsx (component) ← 1
│   └── 📄 pages/prashasakah/AuditLogs.tsx (page)
├── 🧩 components/prashasakah/ChangePasswordModal.tsx (component) ← 1
│   └── 📄 pages/prashasakah/UserDetail.tsx (page)
├── 🧩 components/prashasakah/UserEditModal.tsx (component) ← 2
│   ├── 📄 pages/prashasakah/UserDetail.tsx (page)
│   └── 📄 pages/prashasakah/Users.tsx (page)
├── 🧩 components/prashasakah/UserTable.tsx (component) ← 1
│   └── 📄 pages/prashasakah/Users.tsx (page)
├── 📄 pages/prashasakah/Alerts.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/AuditLogs.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/Dashboard.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/MeetingDetail.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/Meetings.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/Settings.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/UserDetail.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
└── 📄 pages/prashasakah/Users.tsx (page) ← 1
    └── 🔀 router.tsx (router)

🔧 utils/security.ts (util) ← 8 importers
├── 🧩 components/chat/chatUtils.tsx (component) ← 4
│   ├── 🧩 components/chat/ChatInput.tsx (component)
│   ├── 🧩 components/chat/ChatMessageList.tsx (component)
│   ├── 🧩 components/chat/index.ts (component)
│   └── 🧩 components/panels/ChatPanel.tsx (component)
├── 🪝 hooks/useTokenRefresh.ts (hook) ← 1
│   └── 🧩 components/Layout.tsx (component)
├── 📄 pages/HistoryPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/MeetingDetailPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/PreJoinPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/prashasakah/MeetingDetail.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 🔌 services/api.ts (service) ← 22
│   ├── 🧩 components/controls/ControlBar.tsx (component)
│   ├── 🧩 components/panels/ChatPanel.tsx (component)
│   ├── 🧩 components/panels/ParticipantsPanel.tsx (component)
│   └── 🧩 components/panels/SettingsPanel.tsx (component)
│       ... +18 more
└── 📦 store/authStore.ts (store) ← 17
    ├── 🧩 components/Layout.tsx (component)
    ├── 🧩 components/ProtectedRoute.tsx (component)
    ├── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component)
    └── 🧩 components/settings/ApiKeyManager.tsx (component)
        ... +13 more

🧩 components/shared/Skeletons.tsx (component) ← 7 importers
├── 🧩 components/prashasakah/StatCard.tsx (component) ← 2
│   ├── 🧩 components/prashasakah/index.ts (component)
│   └── 📄 pages/prashasakah/Dashboard.tsx (page)
├── 🧩 components/shared/DashboardCalendar.tsx (component) ← 1
│   └── 🧩 components/shared/index.ts (component)
├── 🧩 components/shared/DashboardStats.tsx (component) ← 2
│   ├── 🧩 components/shared/index.ts (component)
│   └── 📄 pages/HomePage.tsx (page)
├── 🧩 components/shared/index.ts (component)
├── 📄 pages/HistoryPage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
├── 📄 pages/HomePage.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
└── 📄 pages/MeetingDetailPage.tsx (page) ← 1
    └── 🔀 router.tsx (router)

```
---

## Backend — Reverse Dependency Tree

_Who imports this file? → Who imports THOSE? → ..._

```
🔧 utils/logger.ts (utility) ← 26 importers
├── ⚙️ config.ts (config) ← 7
│   ├── 🚀 index.ts (entry)
│   ├── 🛡️ middleware/authenticate.ts (middleware)
│   ├── 🛤️ routes/auth.ts (route)
│   └── 🛤️ routes/egress.ts (route)
│       ... +3 more
├── 🚀 index.ts (entry)
├── 🛡️ middleware/authenticate.ts (middleware) ← 20
│   ├── 🛡️ middleware/requireRole.ts (middleware)
│   ├── 🛡️ middleware/requireUser.ts (middleware)
│   ├── 🛤️ routes/apiKeys.ts (route)
│   └── 🛤️ routes/auth.ts (route)
│       ... +16 more
├── 🛤️ routes/apiKeys.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/auth.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/egress.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/external.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/meetings.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/prashasakah/alerts.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/apiKeys.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/auditLogs.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/config.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/health.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/meetings.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/rooms.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/settings.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/stats.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/users.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/rooms.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/token.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/webhook.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🔌 services/database.ts (service) ← 21
│   ├── 🚀 index.ts (entry)
│   ├── 🛡️ middleware/authenticate.ts (middleware)
│   ├── 🛤️ routes/apiKeys.ts (route)
│   └── 🛤️ routes/auth.ts (route)
│       ... +17 more
├── 🔌 services/livekit.ts (service) ← 5
│   ├── 🛤️ routes/egress.ts (route)
│   ├── 🛤️ routes/rooms.ts (route)
│   ├── 🛤️ routes/token.ts (route)
│   └── 🛤️ routes/webhook.ts (route)
│       ... +1 more
├── 🔌 services/redis.ts (service) ← 8
│   ├── 🚀 index.ts (entry)
│   ├── 🛡️ middleware/authenticate.ts (middleware)
│   ├── 🛤️ routes/auth.ts (route)
│   └── 🛤️ routes/rooms.ts (route)
│       ... +4 more
├── 🔌 services/roomService.ts (service) ← 2
│   ├── 🛤️ routes/rooms.ts (route)
│   └── 🛤️ routes/token.ts (route)
└── 🔌 services/webhookService.ts (service) ← 1
    └── 🛤️ routes/webhook.ts (route)

🔌 services/database.ts (service) ← 21 importers
├── 🚀 index.ts (entry)
├── 🛡️ middleware/authenticate.ts (middleware) ← 20
│   ├── 🛡️ middleware/requireRole.ts (middleware)
│   ├── 🛡️ middleware/requireUser.ts (middleware)
│   ├── 🛤️ routes/apiKeys.ts (route)
│   └── 🛤️ routes/auth.ts (route)
│       ... +16 more
├── 🛤️ routes/apiKeys.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/auth.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/egress.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/external.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/meetings.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/prashasakah/alerts.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/apiKeys.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/health.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/meetings.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/rooms.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/stats.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/users.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/rooms.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/token.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/webhook.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🔌 services/alertService.ts (service)
├── 🔌 services/meetingService.ts (service) ← 1
│   └── 🛤️ routes/meetings.ts (route)
├── 🔌 services/roomService.ts (service) ← 2
│   ├── 🛤️ routes/rooms.ts (route)
│   └── 🛤️ routes/token.ts (route)
└── 🔌 services/webhookService.ts (service) ← 1
    └── 🛤️ routes/webhook.ts (route)

🛡️ middleware/authenticate.ts (middleware) ← 20 importers
├── 🛡️ middleware/requireRole.ts (middleware) ← 11
│   ├── 🛤️ routes/apiKeys.ts (route)
│   ├── 🛤️ routes/prashasakah/alerts.ts (route)
│   ├── 🛤️ routes/prashasakah/apiKeys.ts (route)
│   └── 🛤️ routes/prashasakah/auditLogs.ts (route)
│       ... +7 more
├── 🛡️ middleware/requireUser.ts (middleware) ← 2
│   ├── 🛤️ routes/meetings.ts (route)
│   └── 🛤️ routes/rooms.ts (route)
├── 🛤️ routes/apiKeys.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/auth.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/egress.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/external.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/meetings.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/prashasakah/alerts.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/apiKeys.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/auditLogs.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/config.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/health.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/index.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/prashasakah/meetings.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/rooms.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/settings.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/stats.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/users.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/rooms.ts (route) ← 1
│   └── 🚀 index.ts (entry)
└── 🛤️ routes/token.ts (route) ← 1
    └── 🚀 index.ts (entry)

🛡️ middleware/requireRole.ts (middleware) ← 11 importers
├── 🛤️ routes/apiKeys.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/prashasakah/alerts.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/apiKeys.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/auditLogs.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/config.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/health.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/meetings.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/rooms.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/settings.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/stats.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
└── 🛤️ routes/prashasakah/users.ts (route) ← 1
    └── 🛤️ routes/prashasakah/index.ts (route)

🔌 services/redis.ts (service) ← 8 importers
├── 🚀 index.ts (entry)
├── 🛡️ middleware/authenticate.ts (middleware) ← 20
│   ├── 🛡️ middleware/requireRole.ts (middleware)
│   ├── 🛡️ middleware/requireUser.ts (middleware)
│   ├── 🛤️ routes/apiKeys.ts (route)
│   └── 🛤️ routes/auth.ts (route)
│       ... +16 more
├── 🛤️ routes/auth.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/rooms.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/token.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/webhook.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🔌 services/lobbyService.ts (service) ← 1
│   └── 🛤️ routes/rooms.ts (route)
└── 🔌 services/webhookService.ts (service) ← 1
    └── 🛤️ routes/webhook.ts (route)

⚙️ config.ts (config) ← 7 importers
├── 🚀 index.ts (entry)
├── 🛡️ middleware/authenticate.ts (middleware) ← 20
│   ├── 🛡️ middleware/requireRole.ts (middleware)
│   ├── 🛡️ middleware/requireUser.ts (middleware)
│   ├── 🛤️ routes/apiKeys.ts (route)
│   └── 🛤️ routes/auth.ts (route)
│       ... +16 more
├── 🛤️ routes/auth.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/egress.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🔌 services/database.ts (service) ← 21
│   ├── 🚀 index.ts (entry)
│   ├── 🛡️ middleware/authenticate.ts (middleware)
│   ├── 🛤️ routes/apiKeys.ts (route)
│   └── 🛤️ routes/auth.ts (route)
│       ... +17 more
├── 🔌 services/livekit.ts (service) ← 5
│   ├── 🛤️ routes/egress.ts (route)
│   ├── 🛤️ routes/rooms.ts (route)
│   ├── 🛤️ routes/token.ts (route)
│   └── 🛤️ routes/webhook.ts (route)
│       ... +1 more
└── 🔌 services/redis.ts (service) ← 8
    ├── 🚀 index.ts (entry)
    ├── 🛡️ middleware/authenticate.ts (middleware)
    ├── 🛤️ routes/auth.ts (route)
    └── 🛤️ routes/rooms.ts (route)
        ... +4 more

🔌 services/livekit.ts (service) ← 5 importers
├── 🛤️ routes/egress.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/rooms.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/token.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/webhook.ts (route) ← 1
│   └── 🚀 index.ts (entry)
└── 🔌 services/lobbyService.ts (service) ← 1
    └── 🛤️ routes/rooms.ts (route)

🛤️ routes/prashasakah/rateLimiter.ts (route) ← 4 importers
├── 🛤️ routes/prashasakah/apiKeys.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/index.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/prashasakah/rooms.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
└── 🛤️ routes/prashasakah/users.ts (route) ← 1
    └── 🛤️ routes/prashasakah/index.ts (route)

🔧 utils/validation.ts (utility) ← 4 importers
├── 🛤️ routes/auth.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/meetings.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/prashasakah/users.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
└── 🛤️ routes/rooms.ts (route) ← 1
    └── 🚀 index.ts (entry)

🛡️ middleware/rateLimiter.ts (middleware) ← 3 importers
├── 🚀 index.ts (entry)
├── 🛤️ routes/auth.ts (route) ← 1
│   └── 🚀 index.ts (entry)
└── 🛤️ routes/token.ts (route) ← 1
    └── 🚀 index.ts (entry)

```
---

## Frontend — Orphan Files

```
🧩 components/chat/index.ts (component) [5 deps]
🧩 components/pip/pip.css (component) [0 deps]
🧩 components/prashasakah/SettingsSection.tsx (component) [0 deps]
🧩 components/prashasakah/index.ts (component) [4 deps]
🧩 components/prejoin/CreateMeetingForm.tsx (component) [0 deps]
🧩 components/prejoin/CreateMeetingModal.tsx (component) [2 deps]
🧩 components/prejoin/JoinForm.tsx (component) [1 deps]
🧩 components/shared/index.ts (component) [4 deps]
🪝 hooks/useAutoPiP.ts (hook) [1 deps]
🪝 hooks/useCpuMonitor.ts (hook) [3 deps]
🪝 hooks/useLeaveMeeting.ts (hook) [2 deps]
🪝 hooks/useLobbyManager.ts (hook) [0 deps]
🪝 hooks/useMediaSync.ts (hook) [2 deps]
🪝 hooks/usePermissionEnforcer.ts (hook) [2 deps]
🪝 hooks/useRequireRole.ts (hook) [2 deps]
🪝 hooks/useSettingsSync.ts (hook) [1 deps]
🪝 hooks/useSpeakerManager.ts (hook) [1 deps]
🔌 services/PiPWindowManager.ts (service) [1 deps]
📦 store/pipStore.ts (store) [0 deps]
🔧 utils/date.ts (util) [0 deps]
```

## Backend — Orphan Files

```
🔌 services/alertService.ts (service) [1 deps]
```

## Backend SQL Files

- `db/schema.sql`
- `migrations/002_admin_tables.sql`
- `migrations/003_api_keys.sql`

## Legend

```
🚀 Entry   🔀 Router  📄 Page    🧩 Component  🪝 Hook
📦 Store   🔌 Service 🔤 Type    🔧 Utility    ⚙️ Config
🔄 Context 🛡️ Middleware 🛤️ Route 📋 Schema    🎨 Style

── N deps   This node imports N files (children shown below)
★ leaf      No internal imports (end of branch)
↻           Already shown above (deduplicated)
↓           Truncated at depth limit

├── Sibling (more nodes follow)
└── Last sibling
```