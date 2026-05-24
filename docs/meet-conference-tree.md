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

- **139** files, **360** internal imports
- **26** leaf files (no deps), **20** orphans (no importers)
- Avg **2.6** imports/file

  component: 59 · config: 1 · context: 1 · entry: 1 · hook: 32 · page: 23 · router: 1 · service: 5 · store: 3 · style: 1 · type: 4 · util: 8

### Backend

- **41** files, **163** internal imports
- **6** leaf files (no deps), **1** orphans (no importers)
- Avg **4.0** imports/file

  config: 1 · entry: 1 · middleware: 6 · route: 21 · schema: 1 · service: 9 · util: 2

---

## Frontend — N-ary Dependency Tree

```
🚀 main.tsx (entry) ── 2 deps
├── 🔀 router.tsx (router) ── 25 deps
└── 🎨 index.css (style) ★ leaf

Unique files: 116

🔀 router.tsx (router) ── 25 deps
├── 🧩 components/Layout.tsx (component) ── 2 deps
├── 🧩 components/ProtectedRoute.tsx (component) ── 1 deps
├── 📄 pages/ApiKeysPage.tsx (page) ── 2 deps
├── 📄 pages/ForgotPasswordPage.tsx (page) ── 3 deps
├── 📄 pages/HistoryPage.tsx (page) ── 7 deps
├── 📄 pages/HomePage.tsx (page) ── 9 deps
├── 📄 pages/LoginPage.tsx (page) ── 4 deps
├── 📄 pages/MeetingDetailPage.tsx (page) ── 7 deps
├── 📄 pages/NotFoundPage.tsx (page) ★ leaf
├── 📄 pages/PreJoinPage.tsx (page) ── 9 deps
├── 📄 pages/RegisterPage.tsx (page) ── 4 deps
├── 📄 pages/ResetPasswordPage.tsx (page) ── 2 deps
├── 📄 pages/RoomPage.tsx (page) ── 8 deps
├── 📄 pages/SchedulePage.tsx (page) ── 7 deps
├── 📄 pages/ThankYouPage.tsx (page) ── 1 deps
├── 📄 pages/prashasakah/Alerts.tsx (page) ── 3 deps
├── 📄 pages/prashasakah/ApiKeys.tsx (page) ── 1 deps
├── 📄 pages/prashasakah/AuditLogs.tsx (page) ── 3 deps
├── 📄 pages/prashasakah/Dashboard.tsx (page) ── 7 deps
├── 📄 pages/prashasakah/MeetingDetail.tsx (page) ── 3 deps
├── 📄 pages/prashasakah/Meetings.tsx (page) ── 3 deps
├── 📄 pages/prashasakah/PrashasakahLayout.tsx (page) ── 1 deps
├── 📄 pages/prashasakah/Settings.tsx (page) ── 3 deps
├── 📄 pages/prashasakah/UserDetail.tsx (page) ── 6 deps
└── 📄 pages/prashasakah/Users.tsx (page) ── 5 deps

Unique files: 114

```

---

## Backend — N-ary Dependency Tree

```
🚀 index.ts (entry) ── 17 deps
├── ⚙️ config.ts (config) ── 1 deps
├── 🔌 services/database.ts (service) ── 2 deps
├── 🔌 services/redis.ts (service) ── 2 deps
├── 🔧 utils/logger.ts (util) ↻
├── 🛡️ middleware/csrf.ts (middleware) ── 1 deps
├── 🛡️ middleware/rateLimiter.ts (middleware) ★ leaf
├── 🛡️ middleware/requestId.ts (middleware) ★ leaf
├── 🛤️ routes/apiKeys.ts (route) ── 5 deps
├── 🛤️ routes/auth.ts (route) ── 8 deps
├── 🛤️ routes/egress.ts (route) ── 5 deps
├── 🛤️ routes/external.ts (route) ── 3 deps
├── 🛤️ routes/meetings.ts (route) ── 8 deps
├── 🛤️ routes/prashasakah/index.ts (route) ── 12 deps
├── 🛤️ routes/rooms.ts (route) ── 10 deps
├── 🛤️ routes/token.ts (route) ── 7 deps
├── 🛤️ routes/webhook.ts (route) ── 5 deps
└── 🛤️ routes/whiteboard.ts (route) ── 5 deps

Unique files: 40

```

---

## Frontend — Category Tree

```
🎨 (root)/ (3 files)
├── 🎨 index.css [0↓ 1↑] ★ leaf
├── 🚀 main.tsx [2↓ 0↑] → index.css, router.tsx
└── 🔀 router.tsx [25↓ 1↑] → Layout.tsx, ProtectedRoute.tsx, ApiKeysPage.tsx, ForgotPasswordPage.tsx, HistoryPage.tsx, HomePage.tsx, LoginPage.tsx, MeetingDetailPage.tsx, NotFoundPage.tsx, PreJoinPage.tsx, RegisterPage.tsx, ResetPasswordPage.tsx, RoomPage.tsx, SchedulePage.tsx, ThankYouPage.tsx, Alerts.tsx, ApiKeys.tsx, AuditLogs.tsx, Dashboard.tsx, MeetingDetail.tsx, Meetings.tsx, PrashasakahLayout.tsx, Settings.tsx, UserDetail.tsx, Users.tsx

🧩 components/ (59 files)
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
├── 🧩 WhiteboardPanel.tsx [5↓ 0↑] → useWhiteboardAutoSave.ts, useWhiteboardSync.ts, whiteboardApi.ts, roomStore.ts, logger.ts
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
├── 🧩 ConferenceRoom.tsx [18↓ 1↑] → ControlBar.tsx, QualityIndicator.tsx, ChatPanel.tsx, ParticipantsPanel.tsx, SettingsPanel.tsx, PiPContainer.tsx, GridLayout.tsx, ScreenShareLayout.tsx, SpeakerLayout.tsx, WhiteboardLayout.tsx, meetingRoomConfig.ts, ParticipantVisibilityContext.tsx, useDataChannelHandler.tsx, useJoinLeaveSounds.ts, useQualityMonitoring.ts, roomStore.ts, blurProcessorManager.ts, logger.ts
├── 🧩 GridLayout.tsx [3↓ 1↑] → ParticipantTile.tsx, useAdmittedParticipants.ts, roomStore.ts
├── 🧩 LobbyWaiting.tsx [1↓ 1↑] → logger.ts
├── 🧩 ParticipantTile.tsx [4↓ 4↑] → meetingRoomConfig.ts, ParticipantVisibilityContext.tsx, roomStore.ts, logger.ts
├── 🧩 ScreenShareLayout.tsx [1↓ 1↑] → ParticipantTile.tsx
├── 🧩 SpeakerLayout.tsx [3↓ 1↑] → ParticipantTile.tsx, useAdmittedParticipants.ts, roomStore.ts
├── 🧩 WhiteboardLayout.tsx [7↓ 1↑] → ParticipantTile.tsx, useAdmittedParticipants.ts, useWhiteboardAutoSave.ts, useWhiteboardSync.ts, whiteboardApi.ts, roomStore.ts, logger.ts
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

🪝 hooks/ (32 files)
├── 🪝 useAdaptiveQuality.ts [2↓ 1↑] → useCallSizeConfig.ts, useNetworkQuality.ts
├── 🪝 useAdmittedParticipants.ts [1↓ 3↑] → logger.ts
├── 🪝 useAudioControls.ts [2↓ 1↑] → meetingRoomConfig.ts, logger.ts
├── 🪝 useAutoPiP.ts [1↓ 0↑] → logger.ts
├── 🪝 useCallSizeConfig.ts [1↓ 1↑] → meetingRoomConfig.ts
├── 🪝 useCpuMonitor.ts [3↓ 0↑] → meetingRoomConfig.ts, useFpsMonitor.ts, logger.ts
├── 🪝 useDataChannelHandler.tsx [2↓ 1↑] → roomStore.ts, index.ts
├── 🪝 useFormValidation.ts [0↓ 3↑] ★ leaf
├── 🪝 useFpsMonitor.ts [0↓ 1↑] ★ leaf
├── 🪝 useJoinLeaveSounds.ts [0↓ 1↑] ★ leaf
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
├── 🪝 useVisibleParticipants.ts [0↓ 1↑] ★ leaf
├── 🪝 useWhiteboardAutoSave.ts [2↓ 2↑] → whiteboardApi.ts, logger.ts
└── 🪝 useWhiteboardSync.ts [2↓ 2↑] → whiteboardApi.ts, logger.ts

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

🔌 services/ (5 files)
├── 🔌 PiPWindowManager.ts [1↓ 0↑] → logger.ts
├── 🔌 api.ts [4↓ 22↑] → authStore.ts, api.ts, index.ts, security.ts
├── 🔌 apiKeysApi.ts [1↓ 1↑] → api.ts
├── 🔌 prashasakahApi.ts [1↓ 14↑] → api.ts
└── 🔌 whiteboardApi.ts [1↓ 4↑] → api.ts

📦 store/ (3 files)
├── 📦 authStore.ts [4↓ 18↑] → api.ts, index.ts, logger.ts, security.ts
├── 📦 pipStore.ts [0↓ 0↑] ★ leaf
└── 📦 roomStore.ts [2↓ 20↑] → meetingRoomConfig.ts, index.ts

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
├── 🔧 logger.ts [0↓ 55↑] ★ leaf
├── 🔧 roomName.ts [0↓ 2↑] ★ leaf
├── 🔧 security.ts [0↓ 8↑] ★ leaf
└── 🔧 timezone.ts [0↓ 1↑] ★ leaf

```

---

## Backend — Category Tree

```
⚙️ (root)/ (2 files)
├── ⚙️ config.ts [1↓ 9↑] → logger.ts
└── 🚀 index.ts [17↓ 0↑] → config.ts, csrf.ts, rateLimiter.ts, requestId.ts, apiKeys.ts, auth.ts, egress.ts, external.ts, meetings.ts, index.ts, rooms.ts, token.ts, webhook.ts, whiteboard.ts, database.ts, redis.ts, logger.ts

🛡️ middleware/ (6 files)
├── 🛡️ authenticate.ts [4↓ 21↑] → config.ts, database.ts, redis.ts, logger.ts
├── 🛡️ csrf.ts [1↓ 2↑] → logger.ts
├── 🛡️ rateLimiter.ts [0↓ 3↑] ★ leaf
├── 🛡️ requestId.ts [0↓ 1↑] ★ leaf
├── 🛡️ requireRole.ts [1↓ 12↑] → authenticate.ts
└── 🛡️ requireUser.ts [1↓ 2↑] → authenticate.ts

🛤️ routes/ (21 files)
├── 🛤️ apiKeys.ts [5↓ 1↑] → authenticate.ts, requireRole.ts, cache.ts, database.ts, logger.ts
├── 🛤️ auth.ts [8↓ 1↑] → config.ts, authenticate.ts, csrf.ts, rateLimiter.ts, database.ts, redis.ts, logger.ts, validation.ts
├── 🛤️ egress.ts [5↓ 1↑] → config.ts, authenticate.ts, database.ts, livekit.ts, logger.ts
├── 🛤️ external.ts [3↓ 1↑] → authenticate.ts, database.ts, logger.ts
├── 🛤️ meetings.ts [8↓ 1↑] → authenticate.ts, requireUser.ts, meetings.ts, cache.ts, database.ts, meetingService.ts, logger.ts, validation.ts
├── 🛤️ alerts.ts [5↓ 1↑] → authenticate.ts, requireRole.ts, cache.ts, database.ts, logger.ts
├── 🛤️ apiKeys.ts [6↓ 1↑] → authenticate.ts, requireRole.ts, rateLimiter.ts, cache.ts, database.ts, logger.ts
├── 🛤️ auditLogs.ts [3↓ 1↑] → authenticate.ts, requireRole.ts, logger.ts
├── 🛤️ config.ts [5↓ 1↑] → authenticate.ts, requireRole.ts, cache.ts, database.ts, logger.ts
├── 🛤️ health.ts [6↓ 1↑] → config.ts, authenticate.ts, requireRole.ts, database.ts, redis.ts, logger.ts
├── 🛤️ index.ts [12↓ 1↑] → authenticate.ts, alerts.ts, apiKeys.ts, auditLogs.ts, config.ts, health.ts, meetings.ts, rateLimiter.ts, rooms.ts, settings.ts, stats.ts, users.ts
├── 🛤️ meetings.ts [5↓ 1↑] → authenticate.ts, requireRole.ts, cache.ts, database.ts, logger.ts
├── 🛤️ rateLimiter.ts [0↓ 4↑] ★ leaf
├── 🛤️ rooms.ts [7↓ 1↑] → config.ts, authenticate.ts, requireRole.ts, rateLimiter.ts, cache.ts, database.ts, logger.ts
├── 🛤️ settings.ts [4↓ 1↑] → authenticate.ts, requireRole.ts, database.ts, logger.ts
├── 🛤️ stats.ts [5↓ 1↑] → authenticate.ts, requireRole.ts, cache.ts, database.ts, logger.ts
├── 🛤️ users.ts [7↓ 1↑] → authenticate.ts, requireRole.ts, rateLimiter.ts, cache.ts, database.ts, logger.ts, validation.ts
├── 🛤️ rooms.ts [10↓ 1↑] → authenticate.ts, requireUser.ts, cache.ts, database.ts, livekit.ts, lobbyService.ts, redis.ts, roomService.ts, logger.ts, validation.ts
├── 🛤️ token.ts [7↓ 1↑] → authenticate.ts, rateLimiter.ts, database.ts, livekit.ts, redis.ts, roomService.ts, logger.ts
├── 🛤️ webhook.ts [5↓ 1↑] → database.ts, livekit.ts, redis.ts, webhookService.ts, logger.ts
└── 🛤️ whiteboard.ts [5↓ 1↑] → authenticate.ts, requireRole.ts, database.ts, roomService.ts, logger.ts

📋 schemas/ (1 files)
└── 📋 meetings.ts [0↓ 1↑] ★ leaf

🔌 services/ (9 files)
├── 🔌 alertService.ts [1↓ 0↑] → database.ts
├── 🔌 cache.ts [2↓ 10↑] → redis.ts, logger.ts
├── 🔌 database.ts [2↓ 24↑] → config.ts, logger.ts
├── 🔌 livekit.ts [2↓ 5↑] → config.ts, logger.ts
├── 🔌 lobbyService.ts [2↓ 1↑] → livekit.ts, redis.ts
├── 🔌 meetingService.ts [1↓ 1↑] → database.ts
├── 🔌 redis.ts [2↓ 10↑] → config.ts, logger.ts
├── 🔌 roomService.ts [2↓ 3↑] → database.ts, logger.ts
└── 🔌 webhookService.ts [3↓ 1↑] → database.ts, redis.ts, logger.ts

🔧 utils/ (2 files)
├── 🔧 logger.ts [0↓ 29↑] ★ leaf
└── 🔧 validation.ts [0↓ 4↑] ★ leaf

```

---

## Frontend — Reverse Dependency Tree (Most-Depended-Upon)

_Who imports this file? → Who imports THOSE? → ..._

```
🔧 utils/logger.ts (util) ← imported by 55 files
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
├── 🧩 components/panels/WhiteboardPanel.tsx (component)
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
├── 🧩 components/room/ParticipantTile.tsx (component) ← 4
│   ├── 🧩 components/room/GridLayout.tsx (component)
│   ├── 🧩 components/room/ScreenShareLayout.tsx (component)
│   ├── 🧩 components/room/SpeakerLayout.tsx (component)
│   └── 🧩 components/room/WhiteboardLayout.tsx (component)
├── 🧩 components/room/WhiteboardLayout.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/settings/ApiKeyManager.tsx (component) ← 1
│   └── 📄 pages/ApiKeysPage.tsx (page)
├── ⚙️ config/meetingRoomConfig.ts (config) ← 21
│   ├── 🧩 components/chat/ChatHeader.tsx (component)
│   ├── 🧩 components/chat/ChatMessageList.tsx (component)
│   ├── 🧩 components/controls/ControlBar.tsx (component)
│   ├── 🧩 components/panels/ChatPanel.tsx (component)
│   └── 🧩 components/panels/ParticipantListItem.tsx (component)
│       ... +16 more
├── 🪝 hooks/useAdmittedParticipants.ts (hook) ← 3
│   ├── 🧩 components/room/GridLayout.tsx (component)
│   ├── 🧩 components/room/SpeakerLayout.tsx (component)
│   └── 🧩 components/room/WhiteboardLayout.tsx (component)
├── 🪝 hooks/useAudioControls.ts (hook) ← 1
│   └── 🧩 components/controls/ControlBar.tsx (component)
├── 🪝 hooks/useAutoPiP.ts (hook)
├── 🪝 hooks/useCpuMonitor.ts (hook)
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
├── 🪝 hooks/useWhiteboardAutoSave.ts (hook) ← 2
│   ├── 🧩 components/panels/WhiteboardPanel.tsx (component)
│   └── 🧩 components/room/WhiteboardLayout.tsx (component)
├── 🪝 hooks/useWhiteboardSync.ts (hook) ← 2
│   ├── 🧩 components/panels/WhiteboardPanel.tsx (component)
│   └── 🧩 components/room/WhiteboardLayout.tsx (component)
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
├── 📦 store/authStore.ts (store) ← 18
│   ├── 🧩 components/Layout.tsx (component)
│   ├── 🧩 components/ProtectedRoute.tsx (component)
│   ├── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component)
│   ├── 🧩 components/settings/ApiKeyManager.tsx (component)
│   └── 🪝 hooks/usePreJoinAuth.ts (hook)
│       ... +13 more
├── 🔧 utils/blurProcessorManager.ts (util) ← 3
│   ├── 🧩 components/room/ConferenceRoom.tsx (component)
│   ├── 🪝 hooks/usePreJoinMedia.ts (hook)
│   └── 📄 pages/RoomPage.tsx (page)
└── 🔧 utils/cameraCapabilities.ts (util) ← 1
    └── 🪝 hooks/usePreJoinMedia.ts (hook)

🔌 services/api.ts (service) ← imported by 22 files
├── 🧩 components/controls/ControlBar.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/panels/ChatPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/panels/ParticipantsPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/panels/SettingsPanel.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
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
│   ├── 🧩 components/prashasakah/ChangePasswordModal.tsx (component)
│   └── 🧩 components/prashasakah/UserEditModal.tsx (component)
│       ... +9 more
├── 🔌 services/whiteboardApi.ts (service) ← 4
│   ├── 🧩 components/panels/WhiteboardPanel.tsx (component)
│   ├── 🧩 components/room/WhiteboardLayout.tsx (component)
│   ├── 🪝 hooks/useWhiteboardAutoSave.ts (hook)
│   └── 🪝 hooks/useWhiteboardSync.ts (hook)
└── 📦 store/authStore.ts (store) ← 18
    ├── 🧩 components/Layout.tsx (component)
    ├── 🧩 components/ProtectedRoute.tsx (component)
    ├── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component)
    ├── 🧩 components/settings/ApiKeyManager.tsx (component)
    └── 🪝 hooks/usePreJoinAuth.ts (hook)
        ... +13 more

🔧 utils/cn.ts (util) ← imported by 22 files
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
│   ├── 🧩 components/shared/index.ts (component)
│   └── 📄 pages/HistoryPage.tsx (page)
│       ... +2 more
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

⚙️ config/meetingRoomConfig.ts (config) ← imported by 21 files
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
├── 🧩 components/room/ParticipantTile.tsx (component) ← 4
│   ├── 🧩 components/room/GridLayout.tsx (component)
│   ├── 🧩 components/room/ScreenShareLayout.tsx (component)
│   ├── 🧩 components/room/SpeakerLayout.tsx (component)
│   └── 🧩 components/room/WhiteboardLayout.tsx (component)
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
└── 📦 store/roomStore.ts (store) ← 20
    ├── 🧩 components/controls/ControlBar.tsx (component)
    ├── 🧩 components/controls/QualityIndicator.tsx (component)
    ├── 🧩 components/panels/ChatPanel.tsx (component)
    ├── 🧩 components/panels/ParticipantsPanel.tsx (component)
    └── 🧩 components/panels/SettingsPanel.tsx (component)
        ... +15 more

📦 store/roomStore.ts (store) ← imported by 20 files
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
├── 🧩 components/panels/WhiteboardPanel.tsx (component)
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
│   ├── 🧩 components/prejoin/VideoSettings.tsx (component)
│   └── 🧩 components/prejoin/index.ts (component)
├── 🧩 components/room/ConferenceRoom.tsx (component) ← 1
│   └── 📄 pages/RoomPage.tsx (page)
├── 🧩 components/room/GridLayout.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/room/ParticipantTile.tsx (component) ← 4
│   ├── 🧩 components/room/GridLayout.tsx (component)
│   ├── 🧩 components/room/ScreenShareLayout.tsx (component)
│   ├── 🧩 components/room/SpeakerLayout.tsx (component)
│   └── 🧩 components/room/WhiteboardLayout.tsx (component)
├── 🧩 components/room/SpeakerLayout.tsx (component) ← 1
│   └── 🧩 components/room/ConferenceRoom.tsx (component)
├── 🧩 components/room/WhiteboardLayout.tsx (component) ← 1
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

📦 store/authStore.ts (store) ← imported by 18 files
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
├── 📄 pages/prashasakah/Users.tsx (page) ← 1
│   └── 🔀 router.tsx (router)
└── 🔌 services/api.ts (service) ← 22
    ├── 🧩 components/controls/ControlBar.tsx (component)
    ├── 🧩 components/panels/ChatPanel.tsx (component)
    ├── 🧩 components/panels/ParticipantsPanel.tsx (component)
    ├── 🧩 components/panels/SettingsPanel.tsx (component)
    └── 🪝 hooks/useMeetingActions.ts (hook)
        ... +17 more

🔤 types/index.ts (type) ← imported by 16 files
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
│   ├── 🧩 components/panels/SettingsPanel.tsx (component)
│   └── 🪝 hooks/useMeetingActions.ts (hook)
│       ... +17 more
├── 📦 store/authStore.ts (store) ← 18
│   ├── 🧩 components/Layout.tsx (component)
│   ├── 🧩 components/ProtectedRoute.tsx (component)
│   ├── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component)
│   ├── 🧩 components/settings/ApiKeyManager.tsx (component)
│   └── 🪝 hooks/usePreJoinAuth.ts (hook)
│       ... +13 more
├── 📦 store/roomStore.ts (store) ← 20
│   ├── 🧩 components/controls/ControlBar.tsx (component)
│   ├── 🧩 components/controls/QualityIndicator.tsx (component)
│   ├── 🧩 components/panels/ChatPanel.tsx (component)
│   ├── 🧩 components/panels/ParticipantsPanel.tsx (component)
│   └── 🧩 components/panels/SettingsPanel.tsx (component)
│       ... +15 more
└── 🔤 types/api.ts (type) ← 3
    ├── 🧩 components/panels/ParticipantsPanel.tsx (component)
    ├── 🔌 services/api.ts (service)
    └── 🔤 types/index.ts (type)

🔌 services/prashasakahApi.ts (service) ← imported by 14 files
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

🔧 utils/security.ts (util) ← imported by 8 files
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
│   ├── 🧩 components/panels/SettingsPanel.tsx (component)
│   └── 🪝 hooks/useMeetingActions.ts (hook)
│       ... +17 more
└── 📦 store/authStore.ts (store) ← 18
    ├── 🧩 components/Layout.tsx (component)
    ├── 🧩 components/ProtectedRoute.tsx (component)
    ├── 🧩 components/prashasakah/AdminApiKeyManager.tsx (component)
    ├── 🧩 components/settings/ApiKeyManager.tsx (component)
    └── 🪝 hooks/usePreJoinAuth.ts (hook)
        ... +13 more

🧩 components/shared/Skeletons.tsx (component) ← imported by 7 files
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

## Backend — Reverse Dependency Tree (Most-Depended-Upon)

_Who imports this file? → Who imports THOSE? → ..._

```
🔧 utils/logger.ts (util) ← imported by 29 files
├── ⚙️ config.ts (config) ← 9
│   ├── 🚀 index.ts (entry)
│   ├── 🛡️ middleware/authenticate.ts (middleware)
│   ├── 🛤️ routes/auth.ts (route)
│   ├── 🛤️ routes/egress.ts (route)
│   └── 🛤️ routes/prashasakah/health.ts (route)
│       ... +4 more
├── 🚀 index.ts (entry)
├── 🛡️ middleware/authenticate.ts (middleware) ← 21
│   ├── 🛡️ middleware/requireRole.ts (middleware)
│   ├── 🛡️ middleware/requireUser.ts (middleware)
│   ├── 🛤️ routes/apiKeys.ts (route)
│   ├── 🛤️ routes/auth.ts (route)
│   └── 🛤️ routes/egress.ts (route)
│       ... +16 more
├── 🛡️ middleware/csrf.ts (middleware) ← 2
│   ├── 🚀 index.ts (entry)
│   └── 🛤️ routes/auth.ts (route)
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
├── 🛤️ routes/whiteboard.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🔌 services/cache.ts (service) ← 10
│   ├── 🛤️ routes/apiKeys.ts (route)
│   ├── 🛤️ routes/meetings.ts (route)
│   ├── 🛤️ routes/prashasakah/alerts.ts (route)
│   ├── 🛤️ routes/prashasakah/apiKeys.ts (route)
│   └── 🛤️ routes/prashasakah/config.ts (route)
│       ... +5 more
├── 🔌 services/database.ts (service) ← 24
│   ├── 🚀 index.ts (entry)
│   ├── 🛡️ middleware/authenticate.ts (middleware)
│   ├── 🛤️ routes/apiKeys.ts (route)
│   ├── 🛤️ routes/auth.ts (route)
│   └── 🛤️ routes/egress.ts (route)
│       ... +19 more
├── 🔌 services/livekit.ts (service) ← 5
│   ├── 🛤️ routes/egress.ts (route)
│   ├── 🛤️ routes/rooms.ts (route)
│   ├── 🛤️ routes/token.ts (route)
│   ├── 🛤️ routes/webhook.ts (route)
│   └── 🔌 services/lobbyService.ts (service)
├── 🔌 services/redis.ts (service) ← 10
│   ├── 🚀 index.ts (entry)
│   ├── 🛡️ middleware/authenticate.ts (middleware)
│   ├── 🛤️ routes/auth.ts (route)
│   ├── 🛤️ routes/prashasakah/health.ts (route)
│   └── 🛤️ routes/rooms.ts (route)
│       ... +5 more
├── 🔌 services/roomService.ts (service) ← 3
│   ├── 🛤️ routes/rooms.ts (route)
│   ├── 🛤️ routes/token.ts (route)
│   └── 🛤️ routes/whiteboard.ts (route)
└── 🔌 services/webhookService.ts (service) ← 1
    └── 🛤️ routes/webhook.ts (route)

🔌 services/database.ts (service) ← imported by 24 files
├── 🚀 index.ts (entry)
├── 🛡️ middleware/authenticate.ts (middleware) ← 21
│   ├── 🛡️ middleware/requireRole.ts (middleware)
│   ├── 🛡️ middleware/requireUser.ts (middleware)
│   ├── 🛤️ routes/apiKeys.ts (route)
│   ├── 🛤️ routes/auth.ts (route)
│   └── 🛤️ routes/egress.ts (route)
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
├── 🛤️ routes/whiteboard.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🔌 services/alertService.ts (service)
├── 🔌 services/meetingService.ts (service) ← 1
│   └── 🛤️ routes/meetings.ts (route)
├── 🔌 services/roomService.ts (service) ← 3
│   ├── 🛤️ routes/rooms.ts (route)
│   ├── 🛤️ routes/token.ts (route)
│   └── 🛤️ routes/whiteboard.ts (route)
└── 🔌 services/webhookService.ts (service) ← 1
    └── 🛤️ routes/webhook.ts (route)

🛡️ middleware/authenticate.ts (middleware) ← imported by 21 files
├── 🛡️ middleware/requireRole.ts (middleware) ← 12
│   ├── 🛤️ routes/apiKeys.ts (route)
│   ├── 🛤️ routes/prashasakah/alerts.ts (route)
│   ├── 🛤️ routes/prashasakah/apiKeys.ts (route)
│   ├── 🛤️ routes/prashasakah/auditLogs.ts (route)
│   └── 🛤️ routes/prashasakah/config.ts (route)
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
├── 🛤️ routes/token.ts (route) ← 1
│   └── 🚀 index.ts (entry)
└── 🛤️ routes/whiteboard.ts (route) ← 1
    └── 🚀 index.ts (entry)

🛡️ middleware/requireRole.ts (middleware) ← imported by 12 files
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
├── 🛤️ routes/prashasakah/users.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
└── 🛤️ routes/whiteboard.ts (route) ← 1
    └── 🚀 index.ts (entry)

🔌 services/cache.ts (service) ← imported by 10 files
├── 🛤️ routes/apiKeys.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/meetings.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/prashasakah/alerts.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/apiKeys.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/config.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/meetings.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/rooms.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/stats.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/users.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
└── 🛤️ routes/rooms.ts (route) ← 1
    └── 🚀 index.ts (entry)

🔌 services/redis.ts (service) ← imported by 10 files
├── 🚀 index.ts (entry)
├── 🛡️ middleware/authenticate.ts (middleware) ← 21
│   ├── 🛡️ middleware/requireRole.ts (middleware)
│   ├── 🛡️ middleware/requireUser.ts (middleware)
│   ├── 🛤️ routes/apiKeys.ts (route)
│   ├── 🛤️ routes/auth.ts (route)
│   └── 🛤️ routes/egress.ts (route)
│       ... +16 more
├── 🛤️ routes/auth.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/prashasakah/health.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/rooms.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/token.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/webhook.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🔌 services/cache.ts (service) ← 10
│   ├── 🛤️ routes/apiKeys.ts (route)
│   ├── 🛤️ routes/meetings.ts (route)
│   ├── 🛤️ routes/prashasakah/alerts.ts (route)
│   ├── 🛤️ routes/prashasakah/apiKeys.ts (route)
│   └── 🛤️ routes/prashasakah/config.ts (route)
│       ... +5 more
├── 🔌 services/lobbyService.ts (service) ← 1
│   └── 🛤️ routes/rooms.ts (route)
└── 🔌 services/webhookService.ts (service) ← 1
    └── 🛤️ routes/webhook.ts (route)

⚙️ config.ts (config) ← imported by 9 files
├── 🚀 index.ts (entry)
├── 🛡️ middleware/authenticate.ts (middleware) ← 21
│   ├── 🛡️ middleware/requireRole.ts (middleware)
│   ├── 🛡️ middleware/requireUser.ts (middleware)
│   ├── 🛤️ routes/apiKeys.ts (route)
│   ├── 🛤️ routes/auth.ts (route)
│   └── 🛤️ routes/egress.ts (route)
│       ... +16 more
├── 🛤️ routes/auth.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/egress.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/prashasakah/health.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/rooms.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🔌 services/database.ts (service) ← 24
│   ├── 🚀 index.ts (entry)
│   ├── 🛡️ middleware/authenticate.ts (middleware)
│   ├── 🛤️ routes/apiKeys.ts (route)
│   ├── 🛤️ routes/auth.ts (route)
│   └── 🛤️ routes/egress.ts (route)
│       ... +19 more
├── 🔌 services/livekit.ts (service) ← 5
│   ├── 🛤️ routes/egress.ts (route)
│   ├── 🛤️ routes/rooms.ts (route)
│   ├── 🛤️ routes/token.ts (route)
│   ├── 🛤️ routes/webhook.ts (route)
│   └── 🔌 services/lobbyService.ts (service)
└── 🔌 services/redis.ts (service) ← 10
    ├── 🚀 index.ts (entry)
    ├── 🛡️ middleware/authenticate.ts (middleware)
    ├── 🛤️ routes/auth.ts (route)
    ├── 🛤️ routes/prashasakah/health.ts (route)
    └── 🛤️ routes/rooms.ts (route)
        ... +5 more

🔌 services/livekit.ts (service) ← imported by 5 files
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

🛤️ routes/prashasakah/rateLimiter.ts (route) ← imported by 4 files
├── 🛤️ routes/prashasakah/apiKeys.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
├── 🛤️ routes/prashasakah/index.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/prashasakah/rooms.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
└── 🛤️ routes/prashasakah/users.ts (route) ← 1
    └── 🛤️ routes/prashasakah/index.ts (route)

🔧 utils/validation.ts (util) ← imported by 4 files
├── 🛤️ routes/auth.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/meetings.ts (route) ← 1
│   └── 🚀 index.ts (entry)
├── 🛤️ routes/prashasakah/users.ts (route) ← 1
│   └── 🛤️ routes/prashasakah/index.ts (route)
└── 🛤️ routes/rooms.ts (route) ← 1
    └── 🚀 index.ts (entry)

```

---

## Frontend — Orphan Files (Zero Importers)

```
🧩 components/chat/index.ts (component) [5 deps]
🧩 components/panels/WhiteboardPanel.tsx (component) [5 deps]
🧩 components/pip/pip.css (component) [0 deps]
🧩 components/prashasakah/SettingsSection.tsx (component) [0 deps]
🧩 components/prashasakah/index.ts (component) [4 deps]
🧩 components/prejoin/CreateMeetingForm.tsx (component) [0 deps]
🧩 components/prejoin/CreateMeetingModal.tsx (component) [2 deps]
🧩 components/prejoin/JoinForm.tsx (component) [1 deps]
🧩 components/shared/index.ts (component) [4 deps]
🪝 hooks/useAutoPiP.ts (hook) [1 deps]
🪝 hooks/useCpuMonitor.ts (hook) [3 deps]
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

## Backend — Orphan Files (Zero Importers)

```
🔌 services/alertService.ts (service) [1 deps]
```

## Backend SQL Files

- `002_admin_tables.sql`
- `003_api_keys.sql`

## Legend

```
🚀 Entry   🔀 Router  📄 Page    🧩 Component  🪝 Hook
📦 Store   🔌 Service 🔤 Type    🔧 Utility    ⚙️ Config
🔄 Context 🛡️ Middleware 🛤️ Route 📋 Schema    🎨 Style

── N deps   This node imports N files (children shown below)
★ leaf      No internal imports (end of branch)
↻           Already shown above (circular/cross-reference)
↓           Has more children (truncated at depth limit)

├── Sibling (more nodes follow)
└── Last sibling
```