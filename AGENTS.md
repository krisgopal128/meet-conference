# AGENTS.md - Meet Conference Project

Coding guidelines and commands for AI agents working in this repository.

## Project Structure

```
meet-conference/
├── meet-frontend/     # React + Vite + TypeScript frontend
│   └── src/
│       ├── components/   # React components (room, chat, controls, panels, etc.)
│       ├── hooks/       # Custom React hooks (23 total)
│       ├── services/    # API services
│       ├── store/       # Zustand state management
│       ├── types/       # TypeScript types
│       ├── utils/      # Utilities
│       ├── config/     # Configuration
│       └── __tests__/  # Vitest tests
└── meet-backend/      # Express + TypeScript backend
    └── src/
        ├── config.ts, index.ts
        ├── db/schema.sql, migrations/
        ├── middleware/ (authenticate, rateLimiter, requireRole, etc.)
        ├── routes/ (auth, rooms, meetings, webhook, external, etc.)
        ├── services/ (database, redis, livekit, meetingService, etc.)
        ├── schemas/ (Zod validation)
        ├── utils/
        └── __tests__/
```

## Build / Lint / Test Commands

### Frontend (meet-frontend/)
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript check + Vite build |
| `npm run lint` | ESLint with TypeScript |
| `npm run test` | Run Vitest tests |
| `npm run test -- <file>` | Run single test file |
| `npm run test -- --run <pattern>` | Run tests by pattern |

### Backend (meet-backend/)
| Command | Description |
|---------|-------------|
| `npm run dev` | Start with tsx (hot reload) |
| `npm run build` | Compile TypeScript |
| `npm run start` | Start production server |
| `npm run lint` | ESLint src/ |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run typecheck` | TypeScript check only |
| `npm run test` | Run Vitest |
| `npm run test -- <file>` | Run single test file |

## Code Style Guidelines

### General
- **TypeScript**: Strict mode enabled, avoid `any`
- **Backend imports**: Use `.js` extension for ESM (`import from './routes/auth.js'`)
- **Line endings**: LF (Unix-style)
- **No comments**: Unless explaining complex logic

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Source files | kebab-case | `roomName.ts`, `apiKeys.ts` |
| Test files | camelCase.test | `authStore.test.ts` |
| Components | PascalCase | `ChatComponent.tsx` |
| Hooks | camelCase + use* | `useAuthActions.ts` |
| Types/Interfaces | PascalCase | `AuthState`, `User` |
| Constants | SCREAMING_SNAKE | `TOKEN_EXPIRY_LONG` |
| Functions/Variables | camelCase | `login()`, `userData` |
| Unused params | prefix `_` | `function foo(_req, res)` |

### React (Frontend)
- Functional components with hooks only
- Zustand for state management
- **CRITICAL: Never call hooks after early returns** - causes "Rendered fewer hooks than expected"
- Use `clsx` + `tailwind-merge` for className utilities
- Tailwind CSS for styling

```typescript
// WRONG - causes hooks error
if (!token) return <div>Error</div>;
const data = useMemo(() => ..., []); // ❌ useMemo after return

// CORRECT - hooks before any returns
const data = useMemo(() => ..., []); // ✅ always called
if (!token) return <div>Error</div>;
```

### Express (Backend)
- Router pattern for route modules
- Zod for input validation
- Proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- Rate limit sensitive endpoints

```typescript
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

authRouter.post('/register', authLimiter, async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    // handler logic
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});
```

### Error Handling
- Try-catch in async handlers
- Sanitize error messages for client (don't expose internals in production)
- Log errors with context

### Testing
- Tests in `src/__tests__/`
- Vitest with describe/it blocks
- Mock external dependencies

```typescript
// Mock pattern
vi.mock('../../services/database.js', () => ({
  queryOne: vi.fn(),
  query: vi.fn(),
}));
```

## LLM Agent Guidelines (Karpathy-Inspired)

Based on Andrej Karpathy's observations on common LLM coding pitfalls.

### Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## External App Integration (Tuition Notebook)

When handling moderator links from external apps:
- URL params: `?t={token}&role=moderator` or `?role=guest`
- Token (`?t=`) stored in sessionStorage: `sessionStorage.setItem(\`token_${roomName}\`, token)`
- Role stored similarly: `sessionStorage.setItem(\`role_${roomName}\`, role)`
- Read in RoomPage from sessionStorage, pass via state to LiveKitRoom

## Linting Rules
- `@typescript-eslint/no-unused-vars`: Error (except `_` prefixed params)
- `@typescript-eslint/no-explicit-any`: Warning
- `react-hooks/rules-of-hooks`: Error (critical!)
- `react-hooks/exhaustive-deps`: Warning

## Database
- PostgreSQL with raw SQL (no ORM)
- Parameterized queries to prevent SQL injection
- pg library for connection pooling

## Security
- Never commit `.env` or secrets
- Rate limit auth endpoints
- Hash passwords with bcrypt (cost 12)
- JWT for authentication with expiration

---

# Codebase Architecture Audit

## Technology Stack

| Layer | Backend | Frontend |
|-------|---------|----------|
| Runtime | Node.js | Browser |
| Framework | Express | React 18 + Vite |
| Language | TypeScript (strict) | TypeScript (strict) |
| Database | PostgreSQL | - |
| Cache | Redis | - |
| Video | LiveKit Server SDK | LiveKit Client |
| State | - | Zustand (3 stores) |
| Styling | - | Tailwind CSS |
| Validation | Zod | TypeScript |

## Database Schema

### Core Tables
| Table | Purpose |
|-------|---------|
| `users` | User accounts (id, email, password_hash, name, role) |
| `rooms` | Conference rooms (name, title, host_id, status, max_participants) |
| `meetings` | Meeting sessions (room_id, participant_count, started_at/ended_at) |
| `meeting_participants` | Meeting attendance records |
| `scheduled_meetings` | Scheduled meeting events |
| `refresh_tokens` | JWT refresh tokens |

### Admin Tables
| Table | Purpose |
|-------|---------|
| `admin_audit_logs` | Admin action audit trail |
| `admin_alerts` | System alerts for admins |
| `user_activity` | User activity tracking (logins, joins) |
| `system_settings` | System-wide configuration |
| `api_keys` | External API key management |

## API Routes

### Backend Routes
| Prefix | Description |
|--------|-------------|
| `/auth` | Register, login, logout, refresh, forgot-password, reset-password, profile |
| `/token` | Generate LiveKit tokens |
| `/rooms` | CRUD + join, leave, kick, mute-all |
| `/meetings` | List, schedule, history, diagnostics |
| `/egress` | Recording start/stop |
| `/webhook/livekit` | LiveKit webhook handler |
| `/prashasakah` | Admin panel API |
| `/api-keys` | API key CRUD |
| `/external` | External integrations (Tuition Notebook) |
| `/health` | Health check |

### Frontend Routes
| Path | Component |
|------|------------|
| `/login` | LoginPage |
| `/register` | RegisterPage |
| `/join/:roomName` | PreJoinPage |
| `/room/:roomName` | RoomPage |
| `/schedule` | SchedulePage |
| `/history` | HistoryPage |
| `/api-keys` | ApiKeysPage |
| `/prashasakah/*` | Admin panel |

## State Management (Zustand)

### authStore.ts
- User authentication state
- Persisted to localStorage

### roomStore.ts (707 lines - large)
- Connection state (roomName, token, identity, role, isConnecting, isConnected)
- UI state (layout, chat, participants, settings panels)
- Quality state (qualityMode, connectionQualityLabel, packetLoss, rtt, jitter)
- Video state (gridAspectRatio, videoFitMode, backgroundBlurEnabled)

### pipStore.ts
- Picture-in-Picture state

## Custom Hooks (23 total)

| Category | Hooks |
|----------|-------|
| Connection | useTokenRefresh, useRequireRole |
| Media | usePictureInPicture, useAutoPiP, usePermissionEnforcer |
| Performance | useAdaptiveQuality, useCpuMonitor, useFpsMonitor, useNetworkQuality, useQualityMonitoring |
| Room | useVisibleParticipants, useVideoPool, useLobbyManager, useAdmittedParticipants |
| Data | useDataChannelHandler |
| UI | useTabVisibility, useSettingsSync, useSpeakerManager, useMediaSync |
| Audio | useJoinLeaveSounds |
| Utils | useFormValidation, useCallSizeConfig |

## Authentication Flow

1. **Login**: User submits credentials → `/auth/login` → JWT access token + refresh token
2. **Token Refresh**: Access token expires → `/auth/refresh` → new tokens
3. **Logout**: Access token blacklisted in Redis
4. **Authorization**: JWT verified via `authenticate` middleware
5. **Rate Limiting**: Auth endpoints limited (5 failed = 15-min lockout)

## LiveKit Integration

- Room management: createRoom, listRooms, deleteRoom, getRoomInfo
- Token generation: createAccessToken (roles: host, cohost, presenter, attendee, viewer)
- Participant management: listParticipants, removeParticipant, muteAllAudioTracks
- Egress/Recording: egressClient
- Webhooks: WebhookReceiver for events

## External API (Third-party)

- API key authentication (environment + database)
- Rate limiting: 100 requests/hour per key
- Used by Tuition Notebook for room creation and token generation