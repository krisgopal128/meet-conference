# Meet Application Architecture Documentation

> **Generated**: 2026-03-11
> **Version**: 1.1.0
> **Last Updated**: Security Enhancements (Input Sanitization, CSP Headers)

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [LiveKit Integration](#livekit-integration)
8. [Authentication Flow](#authentication-flow)
9. [Meeting Lifecycle](#meeting-lifecycle)
10. [Face Crop Feature](#face-crop-feature)
11. [Recording System](#recording-system)

---

## System Overview

The Meet application is a real-time video conferencing platform built with:
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Media Server**: LiveKit (self-hosted)
- **Database**: PostgreSQL
- **Cache**: Redis
- **Reverse Proxy**: Caddy

### Key Domains

| Service | Domain | Internal Port |
|---------|--------|---------------|
| LiveKit | `livekit.phuket-tourist.com` | 7880 |
| Backend API | `api.livekit.phuket-tourist.com` | 4000 |
| Frontend | `meet.livekit.phuket-tourist.com` | 4173 |

---

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        Mobile[Mobile Browser]
    end

    subgraph "Edge Layer"
        Caddy[Caddy Reverse Proxy]
    end

    subgraph "Application Layer"
        Frontend[React Frontend<br/>:4173]
        Backend[Express Backend<br/>:4000]
    end

    subgraph "Media Layer"
        LiveKit[LiveKit Server<br/>:7880]
    end

    subgraph "Data Layer"
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis)]
    end

    subgraph "Storage Layer"
        S3[S3/MinIO<br/>Recordings]
    end

    Browser --> Caddy
    Mobile --> Caddy
    Caddy --> Frontend
    Caddy --> Backend
    Caddy --> LiveKit
    
    Frontend --> Backend
    Frontend --> LiveKit
    
    Backend --> PostgreSQL
    Backend --> Redis
    Backend --> LiveKit
    Backend --> S3
    
    LiveKit --> S3
```

---

## Frontend Architecture

### Directory Structure

```
/opt/meet-frontend/src/
├── components/
│   ├── controls/          # Meeting controls (audio, video, screen share)
│   ├── panels/            # Side panels (chat, participants, settings)
│   └── room/              # Room components (tiles, layouts, lobby)
├── config/                # Meeting configuration
├── hooks/                 # Custom React hooks
├── pages/                 # Page components
├── services/              # API and external services
├── store/                 # Zustand state stores
├── types/                 # TypeScript type definitions
└── utils/                 # Utility functions
```

### Page Flow Diagram

```mermaid
stateDiagram-v2
    [*] --> HomePage: Authenticated
    [*] --> LoginPage: Not Authenticated
    LoginPage --> RegisterPage: Create Account
    RegisterPage --> HomePage: Success
    LoginPage --> HomePage: Success
    
    HomePage --> PreJoinPage: Create/Join Meeting
    PreJoinPage --> RoomPage: Token Generated
    
    state PreJoinPage {
        [*] --> CheckAuth
        CheckAuth --> LoadSettings
        LoadSettings --> MediaPreview
        MediaPreview --> GetToken
        GetToken --> [*]
    }
    
    state RoomPage {
        [*] --> ConnectLiveKit
        ConnectLiveKit --> LobbyCheck
        LobbyCheck --> ConferenceRoom: Admitted
        LobbyCheck --> LobbyWaiting: In Lobby
        LobbyWaiting --> ConferenceRoom: Admitted
        ConferenceRoom --> [*]
    }
    
    RoomPage --> HomePage: Leave Room
```

### State Management

```mermaid
graph LR
    subgraph "Zustand Stores"
        AuthStore[authStore<br/>User & Token]
        RoomStore[roomStore<br/>Room State]
    end
    
    subgraph "Persisted"
        LocalStorage[(localStorage)]
    end
    
    AuthStore --> LocalStorage
    RoomStore --> LocalStorage
    
    subgraph "Components"
        Pages[Pages]
        Components[Components]
    end
    
    Pages --> AuthStore
    Pages --> RoomStore
    Components --> RoomStore
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `HomePage` | `/pages/HomePage.tsx` | Dashboard with meeting list and quick actions |
| `PreJoinPage` | `/pages/PreJoinPage.tsx` | Device selection and preview before joining |
| `RoomPage` | `/pages/RoomPage.tsx` | Main meeting room with LiveKit integration |
| `ConferenceRoom` | `/components/room/` | Video grid and speaker layouts |
| `ControlBar` | `/components/controls/` | Meeting controls (mute, camera, share) |
| `ParticipantsPanel` | `/components/panels/` | Participant list and management |
| `ChatPanel` | `/components/panels/` | In-meeting chat |

---

## Backend Architecture

### Directory Structure

```
/opt/meet-backend/src/
├── routes/
│   ├── auth.ts           # Authentication endpoints
│   ├── token.ts          # LiveKit token generation
│   ├── rooms.ts          # Room management
│   ├── meetings.ts       # Meeting history
│   ├── egress.ts         # Recording management
│   └── webhook.ts        # LiveKit webhooks
├── services/
│   ├── database.ts       # PostgreSQL connection
│   ├── livekit.ts        # LiveKit SDK wrapper
│   └── redis.ts          # Redis caching
├── middleware/
│   ├── authenticate.ts   # JWT verification
│   └── rateLimiter.ts    # Rate limiting
├── utils/
│   └── validation.ts     # Input sanitization (validator.js)
└── config.ts             # Environment configuration
```

### Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant Caddy
    participant Backend
    participant Middleware
    participant Route
    participant Service
    participant DB

    Client->>Caddy: HTTPS Request
    Caddy->>Backend: Forward to :4000
    Backend->>Middleware: Rate Limiter
    Middleware->>Middleware: Authenticate (if required)
    Middleware->>Route: Route Handler
    Route->>Service: Business Logic
    Service->>DB: Query
    DB-->>Service: Result
    Service-->>Route: Response
    Route-->>Backend: JSON Response
    Backend-->>Caddy: Response
    Caddy-->>Client: HTTPS Response
```

---

## Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ rooms : "hosts"
    users ||--o{ meetings : "creates"
    users ||--o{ meeting_participants : "joins"
    users ||--o{ chat_messages : "sends"
    users ||--o{ scheduled_meetings : "schedules"
    
    rooms ||--o{ meetings : "has sessions"
    meetings ||--o{ meeting_participants : "tracks"
    meetings ||--o{ chat_messages : "contains"
    
    rooms {
        uuid id PK
        string name UK
        string title
        string description
        uuid host_id FK
        int max_participants
        string status
        jsonb settings
        timestamp created_at
        timestamp starts_at
        timestamp ends_at
    }
    
    users {
        uuid id PK
        string email UK
        string password_hash
        string name
        string avatar_url
        timestamp created_at
    }
    
    meetings {
        uuid id PK
        uuid room_id FK
        timestamp started_at
        timestamp ended_at
        int participant_count
        int max_participants
        string recording_url
    }
    
    meeting_participants {
        uuid id PK
        uuid meeting_id FK
        uuid user_id FK
        string identity
        string role
        timestamp joined_at
        timestamp left_at
    }
    
    chat_messages {
        uuid id PK
        uuid meeting_id FK
        uuid user_id FK
        text content
        string message_type
        timestamp created_at
    }
    
    scheduled_meetings {
        uuid id PK
        string room_name
        string title
        string description
        uuid host_id FK
        timestamp scheduled_start
        timestamp scheduled_end
        string[] participant_emails
        string status
    }
```

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts and profiles |
| `rooms` | Meeting room definitions |
| `meetings` | Individual meeting sessions |
| `meeting_participants` | Participant tracking per session |
| `chat_messages` | In-meeting chat history |
| `scheduled_meetings` | Future scheduled meetings |

---

## API Endpoints

### Authentication (`/auth`)

```mermaid
sequenceDiagram
    participant Client
    participant API as /auth/*
    participant DB as PostgreSQL
    participant JWT as JWT Token

    Note over Client,JWT: Registration Flow
    Client->>API: POST /auth/register
    API->>DB: Check email exists
    DB-->>API: Not found
    API->>DB: Create user (hashed password)
    API->>JWT: Generate token
    API-->>Client: { user, token }

    Note over Client,JWT: Login Flow
    Client->>API: POST /auth/login
    API->>DB: Find user by email
    API->>API: Verify password hash
    API->>JWT: Generate token
    API-->>Client: { user, token }
```

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Create new account |
| POST | `/auth/login` | No | Authenticate user |
| GET | `/auth/me` | Yes | Get current user |
| PATCH | `/auth/profile` | Yes | Update profile |
| POST | `/auth/logout` | Yes | Logout (client-side) |

### Token Generation (`/token`)

```mermaid
sequenceDiagram
    participant Client
    participant API as /token/*
    participant DB as PostgreSQL
    participant LK as LiveKit

    Note over Client,LK: Authenticated User Token
    Client->>API: POST /token { roomName, role }
    API->>API: Verify JWT
    API->>DB: Check room exists
    API->>LK: Generate AccessToken
    LK-->>API: JWT Token
    API-->>Client: { token, identity, role }

    Note over Client,LK: Guest Token
    Client->>API: POST /token/guest { roomName, name }
    API->>DB: Check room & password
    API->>DB: Check waiting room
    API->>LK: Generate AccessToken
    LK-->>API: JWT Token
    API-->>Client: { token, identity, inLobby }
```

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/token` | Yes | Get token for authenticated user |
| POST | `/token/guest` | No | Get token for guest user |

### Room Management (`/rooms`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/rooms` | Yes | Create new room |
| GET | `/rooms` | Yes | List user's rooms |
| GET | `/rooms?all=true` | Yes | List all rooms |
| GET | `/rooms/:name` | No | Get room details |
| PATCH | `/rooms/:name` | Yes | Update room (host only) |
| DELETE | `/rooms/:name` | Yes | Delete room (host only) |
| GET | `/rooms/:name/participants` | No | List participants |
| GET | `/rooms/:name/lobby` | Yes | List lobby participants |
| POST | `/rooms/:name/admit/:identity` | Yes | Admit from lobby |
| POST | `/rooms/:name/admit-all` | Yes | Admit all from lobby |
| POST | `/rooms/:name/deny-all` | Yes | Deny all from lobby |
| POST | `/rooms/:name/kick/:identity` | Yes | Remove participant |
| POST | `/rooms/:name/mute/:identity` | Yes | Mute participant audio |
| POST | `/rooms/:name/mute-video/:identity` | Yes | Disable camera |
| POST | `/rooms/:name/mute-all` | Yes | Mute all participants |
| POST | `/rooms/:name/disable-screen/:identity` | Yes | Stop screen share |
| POST | `/rooms/:name/disable-all-cameras` | Yes | Disable all cameras |
| GET | `/rooms/:name/settings` | No | Get room settings |
| PUT | `/rooms/:name/settings` | Yes | Update room settings |
| GET | `/rooms/:name/chat` | Yes | Get chat history |
| POST | `/rooms/:name/chat` | Yes | Send chat message |

### Meeting History (`/meetings`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/meetings` | Yes | List user's meetings |
| GET | `/meetings/history` | Yes | Get meeting history |
| GET | `/meetings/scheduled` | Yes | List scheduled meetings |
| POST | `/meetings/schedule` | Yes | Schedule new meeting |
| GET | `/meetings/:id` | Yes | Get meeting details |
| DELETE | `/meetings/scheduled/:id` | Yes | Cancel scheduled meeting |
| GET | `/meetings/:id/chat` | Yes | Get meeting chat |
| POST | `/meetings/:id/chat` | Yes | Send chat message |
| POST | `/meetings/diagnostics` | Optional | Upload diagnostics |

### Recording (`/egress`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/egress/start` | Yes | Start recording (host) |
| POST | `/egress/stop` | Yes | Stop recording |
| GET | `/egress/status/:roomName` | Yes | Get recording status |
| GET | `/egress/list` | Yes | List all recordings |

### Webhook (`/webhook`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/webhook/livekit` | Signature | LiveKit events |

---

## LiveKit Integration

### Role-Based Permissions

```mermaid
graph TD
    subgraph "Roles"
        Host[Host<br/>Full Admin]
        Cohost[Co-Host<br/>Room Admin]
        Presenter[Presenter<br/>Can Publish]
        Attendee[Attendee<br/>Can Publish]
        Viewer[Viewer<br/>Subscribe Only]
    end
    
    Host --> |"roomCreate, roomAdmin, roomRecord"| LK[LiveKit]
    Cohost --> |"roomAdmin"| LK
    Presenter --> |"canPublish, canPublishData"| LK
    Attendee --> |"canPublish, canPublishData"| LK
    Viewer --> |"canSubscribe only"| LK
```

### Token Generation Flow

```mermaid
flowchart TD
    A[Request Token] --> B{Authenticated?}
    B -->|Yes| C[Get User from JWT]
    B -->|No| D[Guest Flow]
    
    C --> E{Role Specified?}
    E -->|No| F[Default: attendee]
    E -->|Yes| G{Role = host?}
    
    G -->|Yes| H{User = Room Host?}
    H -->|Yes| I[Grant host role]
    H -->|No| J[403 Forbidden]
    
    G -->|No| K[Grant specified role]
    
    D --> L{Room Password?}
    L -->|Yes| M[Verify Password]
    L -->|No| N{Waiting Room?}
    
    M --> N
    N -->|Yes| O[Generate Lobby Token<br/>canPublish: false]
    N -->|No| P[Generate Attendee Token]
    
    I --> Q[Create AccessToken]
    K --> Q
    O --> Q
    P --> Q
    
    Q --> R[Return JWT]
```

### Webhook Event Flow

```mermaid
sequenceDiagram
    participant LK as LiveKit Server
    participant Webhook as /webhook/livekit
    participant DB as PostgreSQL
    participant Redis as Redis Cache

    Note over LK,Redis: Room Started
    LK->>Webhook: room_started event
    Webhook->>DB: Create meeting record
    Webhook->>DB: Update room status = 'active'

    Note over LK,Redis: Participant Joined
    LK->>Webhook: participant_joined event
    Webhook->>Redis: Add to participant cache
    Webhook->>DB: Create meeting_participant
    Webhook->>DB: Update participant count

    Note over LK,Redis: Participant Left
    LK->>Webhook: participant_left event
    Webhook->>Redis: Remove from cache
    Webhook->>DB: Update left_at timestamp
    Webhook->>DB: Update participant count

    Note over LK,Redis: Room Finished
    LK->>Webhook: room_finished event
    Webhook->>DB: Update meeting ended_at
    Webhook->>DB: Update room status = 'ended'
    Webhook->>Redis: Clear participant cache
```

---

## Authentication Flow

### Complete Auth Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL
    participant LK as LiveKit

    Note over U,LK: Initial Login
    U->>FE: Enter credentials
    FE->>BE: POST /auth/login
    BE->>DB: Verify credentials
    DB-->>BE: User record
    BE->>BE: Generate JWT (7d expiry)
    BE-->>FE: { user, token }
    FE->>FE: Store in localStorage
    
    Note over U,LK: API Request
    FE->>BE: GET /rooms (Authorization: Bearer token)
    BE->>BE: Verify JWT
    BE-->>FE: Rooms list
    
    Note over U,LK: Join Meeting
    FE->>BE: POST /token { roomName }
    BE->>BE: Verify JWT
    BE->>DB: Check room permissions
    BE->>LK: Generate AccessToken
    LK-->>BE: LiveKit JWT
    BE-->>FE: { token, identity }
    FE->>LK: Connect with token
    LK-->>FE: Connected to room
```

### Guest Access Flow

```mermaid
sequenceDiagram
    participant G as Guest
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL
    participant LK as LiveKit

    G->>FE: Enter room code
    FE->>BE: GET /rooms/:name
    BE->>DB: Get room info
    DB-->>BE: Room (with password_hash, waiting_room_enabled)
    BE-->>FE: Room info
    
    alt Room has password
        FE->>FE: Prompt for password
        G->>FE: Enter password
    end
    
    FE->>BE: POST /token/guest { roomName, name, password }
    BE->>DB: Verify password (if needed)
    
    alt Waiting room enabled
        BE->>LK: Generate token with canPublish: false
        BE-->>FE: { token, inLobby: true }
        FE->>LK: Connect (lobby mode)
        Note over G,LK: Guest waits in lobby
    else No waiting room
        BE->>LK: Generate normal token
        BE-->>FE: { token, inLobby: false }
        FE->>LK: Connect directly
    end
```

---

## Meeting Lifecycle

### State Diagram

```mermaid
stateDiagram-v2
    [*] --> Created: User creates room
    Created --> Scheduled: Future start time
    Created --> Waiting: Immediate start
    
    Scheduled --> Waiting: Start time reached
    Scheduled --> Cancelled: Host cancels
    
    Waiting --> Active: First participant joins
    Active --> Active: Participants join/leave
    Active --> Recording: Host starts recording
    Recording --> Active: Recording stopped
    Active --> Ended: Last participant leaves
    Active --> Ended: Host ends meeting
    
    Ended --> [*]
    Cancelled --> [*]
```

### Complete Meeting Flow

```mermaid
sequenceDiagram
    participant H as Host
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL
    participant LK as LiveKit
    participant Redis as Redis

    Note over H,Redis: 1. Create Room
    H->>FE: Click "New Meeting"
    FE->>BE: POST /rooms { name, title, settings }
    BE->>DB: Insert room
    BE->>LK: CreateRoom (optional)
    BE-->>FE: Room created

    Note over H,Redis: 2. Join Room
    H->>FE: Click "Join"
    FE->>FE: Navigate to PreJoinPage
    FE->>BE: GET /rooms/:name
    BE-->>FE: Room info
    FE->>FE: Show device preview
    
    Note over H,Redis: 3. Get Token
    H->>FE: Click "Join Meeting"
    FE->>BE: POST /token { roomName }
    BE->>DB: Verify host
    BE->>LK: Generate host token
    BE-->>FE: { token, role: 'host' }
    
    Note over H,Redis: 4. Connect to LiveKit
    FE->>LK: Connect with token
    LK->>LK: Create room if needed
    LK-->>FE: Connected
    FE->>FE: Navigate to RoomPage
    
    Note over H,Redis: 5. Room Started Webhook
    LK->>BE: POST /webhook/livekit (room_started)
    BE->>DB: Create meeting record
    BE->>DB: Update room status = 'active'
    
    Note over H,Redis: 6. Participant Events
    loop Each participant
        LK->>BE: participant_joined
        BE->>Redis: Cache participant
        BE->>DB: Create meeting_participant
    end
    
    Note over H,Redis: 7. Meeting in Progress
    FE->>LK: Publish audio/video
    LK-->>FE: Receive remote tracks
    FE->>BE: POST /rooms/:name/chat
    BE->>DB: Store chat message
    
    Note over H,Redis: 8. End Meeting
    H->>FE: Click "Leave"
    FE->>LK: Disconnect
    LK->>BE: POST /webhook/livekit (room_finished)
    BE->>DB: Update meeting ended_at
    BE->>DB: Update room status = 'ended'
    BE->>Redis: Clear participant cache
    FE->>FE: Navigate to HomePage
```

---

## Face Crop Feature

### Architecture

```mermaid
flowchart TD
    subgraph "PreJoinPage"
        A[Camera Stream] --> B[Face Detection]
        B --> C[Calculate Crop Region]
        C --> D[Canvas Draw Cropped]
        D --> E[Preview Display]
    end
    
    subgraph "RoomPage"
        F[Original Camera] --> G[Unpublish Default Track]
        G --> H[FaceCropProcessor]
        H --> I[Face Detection]
        I --> J[Canvas Crop]
        J --> K[Cropped Stream]
        K --> L[LocalVideoTrack]
        L --> M[Publish to LiveKit]
    end
    
    subgraph "FaceCropProcessor"
        N[Input Video] --> O[Detect Faces<br/>face-api.js]
        O --> P[Smooth Position]
        P --> Q[Apply Aspect Ratio]
        Q --> R[Canvas Render]
        R --> S[Output Stream]
    end
```

### Face Detection Models

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| Tiny Face Detector | 193KB | Fast | Lower | Most meetings |
| SSD MobileNet | 5.6MB | Slower | Higher | Large groups |

### Settings Storage

```mermaid
flowchart LR
    subgraph "Moderator Sets"
        A[PreJoinPage] --> B[Save to Room Settings]
        C[HomePage Modal] --> B
    end
    
    B --> D[(Database<br/>rooms.settings)]
    
    subgraph "Participant Joins"
        E[PreJoinPage] --> F[Fetch Room Settings]
        F --> D
        E --> G[Apply Face Crop]
    end
```

---

## Recording System

### Recording Flow

```mermaid
sequenceDiagram
    participant H as Host
    participant FE as Frontend
    participant BE as Backend
    participant LK as LiveKit
    participant S3 as S3/MinIO

    H->>FE: Click "Start Recording"
    FE->>BE: POST /egress/start { roomName }
    BE->>BE: Verify host permission
    BE->>LK: StartRoomCompositeEgress
    LK->>S3: Configure output
    LK-->>BE: { egressId }
    BE->>BE: Store egressId in room metadata
    BE-->>FE: { egressId, status }
    
    Note over LK,S3: Recording in progress...
    
    H->>FE: Click "Stop Recording"
    FE->>BE: POST /egress/stop { egressId }
    BE->>LK: StopEgress
    LK->>S3: Finalize file
    LK->>BE: Webhook: egress_ended
    BE->>BE: Update meeting recording_url
    BE-->>FE: { status }
```

---

## Security

### Rate Limiting

| Limiter | Limit | Window |
|---------|-------|--------|
| General API | 500 requests | 15 minutes |
| Token | 60 requests | 1 minute |
| Auth | 10 requests | 1 hour |
| Webhook | 100 requests | 1 minute |

### CORS Configuration

```javascript
// Allowed origins (from config)
origins: [
  'https://meet.livekit.phuket-tourist.com',
  'http://localhost:5173', // Development
]
```

### Authentication Layers

1. **JWT Token** - User authentication (7-day expiry)
2. **LiveKit Token** - Room access (1-hour default)
3. **Room Password** - Optional room protection
4. **Waiting Room** - Manual admission by moderator

### Input Sanitization (validator.js)

All user inputs are sanitized using `validator.js` to prevent XSS and injection attacks.

**File**: `/opt/meet-backend/src/utils/validation.ts`

| Function | Purpose | Example |
|----------|---------|---------|
| `sanitizeEmail()` | Trim, lowercase, validate format | `USER@Example.com` → `user@example.com` |
| `sanitizeName()` | Strip HTML, escape entities, limit 100 chars | `<script>alert(1)</script>` → `&lt;script&gt;alert(1)&lt;/script&gt;` |
| `sanitizeRoomName()` | Lowercase alphanumeric + hyphens, must start with letter | `My-Room-2024` → `my-room-2024` |
| `sanitizeDescription()` | Strip HTML, escape entities | Prevents XSS in room descriptions |
| `sanitizeUrl()` | Validate URL, only http/https | Prevents javascript: URLs |
| `sanitizeChatMessage()` | Strip control chars, escape HTML, max 5000 chars | Prevents XSS in chat |
| `validatePassword()` | 8-128 characters | Enforces password strength |

### Room Name Validation Rules

Room names are strictly validated to prevent injection and ensure URL-safe identifiers:

| Rule | Example | Valid |
|------|---------|-------|
| Must start with a letter | `my-room` | ✅ |
| | `1-room` | ❌ |
| Lowercase only | `meeting-2024` | ✅ |
| | `My-Room` | ❌ |
| Alphanumeric + hyphens | `team-standup` | ✅ |
| | `my_room` | ❌ |
| No consecutive hyphens | `my--room` | ❌ |
| Cannot end with hyphen | `meeting-` | ❌ |
| Length: 3-100 characters | `ab` | ❌ |

**Regex**: `^[a-z][a-z0-9-]{2,99}$`

### Routes with Sanitization

| Route | Fields Sanitized |
|-------|------------------|
| `POST /auth/register` | `email`, `name`, `password` (validation) |
| `POST /auth/login` | `email` |
| `PATCH /auth/profile` | `name`, `avatarUrl` |
| `POST /rooms` | `name`, `description` |
| `POST /rooms/:name/chat` | `content` |

### SQL Injection Prevention

All database queries use **parameterized queries** with `$1, $2, $3` placeholders:

```typescript
// ✅ Safe - parameterized query
await query('SELECT * FROM users WHERE email = $1', [email]);

// ❌ Never used - vulnerable to SQL injection
await query(`SELECT * FROM users WHERE email = '${email}'`);
```

### CSP Headers (Caddy Reverse Proxy)

Content Security Policy headers are applied at the reverse proxy level:

#### API (`api.livekit.phuket-tourist.com`)

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

#### Frontend (`meet.livekit.phuket-tourist.com`)

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss://livekit.phuket-tourist.com https://livekit.phuket-tourist.com https://api.livekit.phuket-tourist.com; media-src 'self' https://livekit.phuket-tourist.com blob:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

#### LiveKit (`livekit.phuket-tourist.com`)

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

### Security Architecture Diagram

```mermaid
flowchart TB
    subgraph "Client"
        Browser[Web Browser]
    end
    
    subgraph "Edge Security"
        Caddy[Caddy Reverse Proxy]
        CSP[CSP Headers]
        Frame[X-Frame-Options]
        XSS[X-XSS-Protection]
    end
    
    subgraph "Application Security"
        RL[Rate Limiter]
        JWT[JWT Authentication]
        Input[Input Sanitization]
        SQL[Parameterized Queries]
    end
    
    subgraph "Data Security"
        DB[(PostgreSQL)]
        Redis[(Redis)]
    end
    
    Browser --> Caddy
    Caddy --> CSP
    Caddy --> Frame
    Caddy --> XSS
    CSP --> RL
    RL --> JWT
    JWT --> Input
    Input --> SQL
    SQL --> DB
    SQL --> Redis
```

---

## Configuration

### Environment Variables

#### Backend (`/opt/meet-backend/.env`)

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://user:pass@localhost:5432/meetdb
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret
LIVEKIT_API_KEY=your-key
LIVEKIT_API_SECRET=your-secret
LIVEKIT_URL=http://localhost:7880
```

#### Frontend (`/opt/meet-frontend/.env`)

```env
VITE_API_URL=https://api.livekit.phuket-tourist.com/api
VITE_LIVEKIT_URL=wss://livekit.phuket-tourist.com
```

---

## Error Handling

### API Error Response Format

```typescript
interface ErrorResponse {
  error: string;           // Human-readable message
  details?: ZodError[];    // Validation errors
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| 400 | Validation error |
| 401 | Authentication required |
| 403 | Permission denied |
| 404 | Resource not found |
| 409 | Conflict (e.g., room exists) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## Performance Optimizations

1. **Lazy Loading** - All pages are lazy-loaded with React.lazy()
2. **Code Splitting** - Vendor, LiveKit, and face-api chunks
3. **Model Preloading** - Face detection models loaded on app start
4. **Redis Caching** - Participant lists cached in Redis
5. **Connection Pooling** - PostgreSQL connection pool
6. **Adaptive Streaming** - LiveKit adaptive stream enabled

---

## Deployment

### Service Management (systemd)

```bash
# Backend
sudo systemctl status meet-backend

# Frontend (Vite preview)
sudo systemctl status meet-frontend

# LiveKit
sudo systemctl status livekit
```

### Log Locations

```
/opt/meet-backend/logs/        # Backend logs
/opt/livekit/logs/             # LiveKit logs
/var/log/caddy/                # Caddy access/error logs
```

---

*Documentation generated by nanobot on 2026-03-10*
