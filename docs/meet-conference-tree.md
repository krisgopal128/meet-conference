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
│   ├── components/           🧩 58 UI components
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

- **138** files, **339** internal imports
- **47** orphans (no importers, not reachable from entry)
- Avg **2.5** imports/file

  component: 58 · hook: 32 · page: 24 · util: 8 · service: 5 · type: 4 · store: 3 · entry: 1 · router: 1 · context: 1 · config: 1

### Backend

- **41** files, **169** internal imports
- **2** orphans (no importers, not reachable from entry)
- Avg **4.1** imports/file

  route: 21 · service: 9 · middleware: 6 · util: 2 · config: 1 · entry: 1 · schema: 1

---

## Frontend — Deep N-ary Dependency Tree (All Levels)

_Full recursive expansion from entry point to leaf nodes._

```
🚀 main.tsx (entry) ── 1 deps
└── 🔀 router.tsx (router) ── 2 deps
└── ├── 🧩 components/Layout.tsx (component) ── 2 deps
└── ├── ├── 📦 store/authStore.ts (store) ── 4 deps
└── ├── ├── ├── 🔤 types/index.ts (type) ── 3 deps
└── ├── ├── ├── ├── 🔤 types/participant.ts (type) ★ leaf
└── ├── ├── ├── ├── 🔤 types/room.ts (type) ★ leaf
└── ├── ├── ├── └── 🔤 types/api.ts (type) ── 2 deps
└── ├── ├── ├── └── ├── 🔤 types/index.ts (type) ↻
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
└── └── 🧩 components/ProtectedRoute.tsx (component) ── 1 deps
└── └── └── 📦 store/authStore.ts (store) ↻
```

### Frontend Orphans (not imported by any file)

```
  ❌ components/chat/index.ts (component) [0 importers] ★ orphan leaf
  ❌ components/panels/ChatPanel.tsx (component) [0 importers] ★ orphan leaf
  ❌ components/panels/ParticipantsPanel.tsx (component) [0 importers] ★ orphan leaf
  ❌ components/panels/SettingsPanel.tsx (component) [0 importers] ★ orphan leaf
  ❌ components/panels/WhiteboardPanel.tsx (component) [0 importers] ★ orphan leaf
  ❌ components/pip/index.ts (component) [0 importers] ★ orphan leaf
  ❌ components/prashasakah/SettingsSection.tsx (component) [0 importers] ★ orphan leaf
  ❌ components/prashasakah/index.ts (component) [0 importers] ★ orphan leaf
  ❌ components/prejoin/CreateMeetingForm.tsx (component) [0 importers] ★ orphan leaf
  ❌ components/prejoin/CreateMeetingModal.tsx (component) [0 importers] ★ orphan leaf
  ❌ components/prejoin/JoinForm.tsx (component) [0 importers] ★ orphan leaf
  ❌ components/room/WhiteboardLayout.tsx (component) [0 importers] ★ orphan leaf
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
  ❌ pages/ApiKeysPage.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/ForgotPasswordPage.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/HistoryPage.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/HomePage.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/LoginPage.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/MeetingDetailPage.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/NotFoundPage.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/PreJoinPage.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/RecordingsPage.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/RegisterPage.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/ResetPasswordPage.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/ThankYouPage.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/prashasakah/Alerts.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/prashasakah/ApiKeys.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/prashasakah/AuditLogs.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/prashasakah/Dashboard.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/prashasakah/MeetingDetail.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/prashasakah/Meetings.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/prashasakah/PrashasakahLayout.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/prashasakah/Settings.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/prashasakah/UserDetail.tsx (page) [0 importers] ★ orphan leaf
  ❌ pages/prashasakah/Users.tsx (page) [0 importers] ★ orphan leaf
  ❌ services/PiPWindowManager.ts (service) [0 importers] ★ orphan leaf
  ❌ store/pipStore.ts (store) [0 importers] ★ orphan leaf
  ❌ utils/date.ts (util) [0 importers] ★ orphan leaf
```

---

## Backend — Deep N-ary Dependency Tree (All Levels)

_Full recursive expansion from entry point to leaf nodes._

```
🚀 index.ts (entry) ── 17 deps
├── 🛤️ routes/auth.ts (route) ── 9 deps
├── ├── ⚙️ config.ts (config) ── 1 deps
├── ├── └── 🔧 utils/logger.ts (util) ★ leaf
├── ├── 🔌 services/database.ts (service) ── 2 deps
├── ├── ├── ⚙️ config.ts (config) ↻
├── ├── └── 🔧 utils/logger.ts (util) ↻
├── ├── 🛡️ middleware/authenticate.ts (middleware) ── 5 deps
├── ├── ├── ⚙️ config.ts (config) ↻
├── ├── ├── 🔌 services/database.ts (service) ↻
├── ├── ├── 🔌 services/redis.ts (service) ── 2 deps
├── ├── ├── ├── ⚙️ config.ts (config) ↻
├── ├── ├── └── 🔧 utils/logger.ts (util) ↻
├── ├── ├── 🔌 services/redis.ts (service) ↻
├── ├── └── 🔧 utils/logger.ts (util) ↻
├── ├── 🛡️ middleware/rateLimiter.ts (middleware) ★ leaf
├── ├── 🔌 services/redis.ts (service) ↻
├── ├── 🛡️ middleware/authenticate.ts (middleware) ↻
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
├── 🛤️ routes/webhook.ts (route) ── 6 deps
├── ├── 🔌 services/livekit.ts (service) ↻
├── ├── 🔌 services/database.ts (service) ↻
├── ├── 🔌 services/redis.ts (service) ↻
├── ├── 🔌 services/webhookService.ts (service) ── 3 deps
├── ├── ├── 🔌 services/database.ts (service) ↻
├── ├── ├── 🔌 services/redis.ts (service) ↻
├── ├── └── 🔧 utils/logger.ts (util) ↻
├── ├── 🔌 services/livekit.ts (service) ↻
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
├── 📦 store/authStore.ts (store) ← 18 importers
├── 🔤 types/index.ts (type) ← 18 importers
├── 🔧 utils/security.ts (util) ← 8 importers
├── 🔤 types/api.ts (type) ← 3 importers
├── 🧩 components/Layout.tsx (component) ← 1 importers
├── 🧩 components/ProtectedRoute.tsx (component) ← 1 importers
├── 🪝 hooks/useTokenRefresh.ts (hook) ← 1 importers
├── 🔀 router.tsx (router) ← 1 importers
├── 🔤 types/participant.ts (type) ← 1 importers
├── 🔤 types/room.ts (type) ← 1 importers
```

---

## Backend — Importer Count (files sorted by how many files import them)

```
├── 🔧 utils/logger.ts (util) ← 29 importers
├── 🔌 services/database.ts (service) ← 25 importers
├── 🛡️ middleware/authenticate.ts (middleware) ← 22 importers
├── 🛡️ middleware/requireRole.ts (middleware) ← 11 importers
├── 🔌 services/redis.ts (service) ← 11 importers
├── ⚙️ config.ts (config) ← 10 importers
├── 🔌 services/cache.ts (service) ← 10 importers
├── 🔌 services/livekit.ts (service) ← 8 importers
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
