# Meet Conference Engineering PRD

## 1. Document Purpose

This document describes the engineering product requirements for `meet-conference`, a self-hosted meeting and collaboration platform built around LiveKit, React, Express, PostgreSQL, and Redis/Valkey.

This is an implementation-oriented PRD intended for:
- engineering planning
- backend/frontend coordination
- deployment/ops alignment
- QA and regression testing
- future feature extension

It is based on the current codebase structure and implemented behavior.

## 2. Product Summary

Meet Conference is a browser-based conferencing platform that supports:
- authenticated and guest room access
- real-time audio/video meetings
- waiting room and moderation controls
- collaborative whiteboard
- in-meeting chat and polls
- scheduling and meeting history
- admin operations console
- external API-key based integrations
- mobile-responsive participation

The platform is intended to be self-hosted on standard Linux infrastructure.

## 3. Product Objectives

### 3.1 Primary Objectives

1. Deliver reliable real-time meetings using commodity browsers.
2. Support role-based control for hosts, moderators, participants, guests, and admins.
3. Provide collaboration features that go beyond video-only conferencing.
4. Preserve operational control through self-hosted deployment and admin tools.
5. Maintain compatibility across desktop and mobile browsers.

### 3.2 Secondary Objectives

1. Support external system integration through API keys.
2. Provide observability via diagnostics, health checks, logs, and admin dashboards.
3. Offer strong session security with refresh-token rotation and CSRF protection.

## 4. Non-Goals

The current platform does not target:
- native mobile apps
- enterprise SSO as the default auth path
- large-scale webinar production tooling
- end-to-end LMS replacement
- advanced AI meeting assistance as a core shipped feature
- offline meeting or offline whiteboard support

## 5. Personas

### 5.1 Host / Moderator

Needs to:
- create and manage rooms
- admit/reject users from the lobby
- control who can chat, unmute, turn on camera, or share screen
- use whiteboard and control whiteboard lock state
- manage meeting settings and quality defaults

### 5.2 Participant

Needs to:
- join reliably from link or room code
- use camera, mic, screen share, chat, polls, and whiteboard if permitted
- have a responsive UI on desktop and mobile

### 5.3 Guest

Needs to:
- join quickly without full registration where guest access is enabled
- interact with the meeting under host restrictions

### 5.4 Platform Admin

Needs to:
- monitor platform usage and health
- manage users and meetings
- audit privileged actions
- manage API keys and platform settings

### 5.5 External Integrator

Needs to:
- create rooms or generate tokens from another system
- enforce scoped access through API key permissions

## 6. High-Level Architecture

### 6.1 Frontend

- Framework: React + Vite + TypeScript
- State: Zustand
- Styling: Tailwind CSS
- Real-time AV UI: LiveKit React components + custom room layouts
- Collaboration UI: Excalidraw-based whiteboard, custom chat and poll UI

### 6.2 Backend

- Framework: Express + TypeScript
- Validation: Zod
- Auth: JWT access tokens + refresh tokens
- Persistence: PostgreSQL
- Cache / coordination: Redis or Valkey
- Media orchestration: LiveKit server SDK

### 6.3 Media Layer

- LiveKit server for room/media transport
- WebRTC audio/video/screen share
- Data channels for whiteboard/chat/polls/moderation signals

### 6.4 Infra / Deployment

- Linux host
- Reverse proxy: Caddy or Nginx
- HTTPS termination
- systemd service management
- PostgreSQL + Redis/Valkey + LiveKit + backend + frontend static hosting

## 7. Repository Structure

### 7.1 Frontend

`meet-frontend/`
- `src/components/`
- `src/pages/`
- `src/hooks/`
- `src/store/`
- `src/services/`
- `src/config/`
- `src/contexts/`
- `src/__tests__/`

### 7.2 Backend

`meet-backend/`
- `src/routes/`
- `src/middleware/`
- `src/services/`
- `src/db/schema.sql`
- `migrations/`
- `src/__tests__/`

### 7.3 Infrastructure

- `livekit/livekit.yaml`
- `deploy.sh`
- `start-meet.sh`
- `docs/`

## 8. Core Functional Scope

## 8.1 Authentication and Session Management

### 8.1.1 Required Features

The platform must support:
- registration with email/password
- login with email/password
- logout
- profile retrieval
- forgot-password flow
- reset-password flow
- access token refresh
- role-aware auth enforcement

### 8.1.2 Token Model

The authentication system must use:
- short-lived access tokens
- rotating refresh tokens
- refresh token persistence in the database
- refresh token hashing at rest
- httpOnly cookie delivery for refresh token

### 8.1.3 Security Controls

The auth system must include:
- JWT secret validation at startup
- CSRF protection for state-changing routes
- token blacklist support for logout / revocation behavior
- rate limiting on sensitive auth endpoints
- lockout behavior after repeated failures

### 8.1.4 Roles

The system must support at minimum:
- `admin`
- `host`
- `cohost`
- `moderator`
- `participant` / `attendee`
- `viewer`
- guest semantics where applicable

## 8.2 Room and Meeting Lifecycle

### 8.2.1 Room Model

Each room must support:
- unique room name
- optional title and description
- host linkage
- status
- max participants
- optional password
- settings payload
- waiting room enablement
- timestamps

### 8.2.2 Room States

Rooms should move through states such as:
- `waiting`
- `active`
- `ended`

### 8.2.3 Meeting Records

Each actual active session should create or map to a meeting record containing:
- room reference
- participant counts
- recording URL if any
- started/ended timestamps
- session status

There must be at most one active meeting row per room.

### 8.2.4 Joining Behavior

The system must support:
- authenticated join
- guest join
- room existence validation
- permission checks for special roles
- restart handling for ended rooms by host

## 8.3 Audio/Video Meeting Experience

### 8.3.1 Prejoin

Prejoin must support:
- camera preview
- mic/camera toggles
- device selection
- quality selection
- screen share mode preference
- aspect ratio / fit preference
- blur/effects preview
- joining with selected local settings

### 8.3.2 In-Room AV

The meeting room must support:
- local camera/mic publish
- remote participant rendering
- screen share rendering
- pin/speaker/grid/screen-share/whiteboard layouts
- local tile mirroring
- participant identity/title overlays
- connection quality indicators

### 8.3.3 Adaptive Behavior

The room experience should incorporate:
- adaptive stream behavior
- quality fallback behavior
- connection diagnostics
- optional battery/network/cpu reactions

### 8.3.4 Device Handling

The UI must support:
- switching video input devices
- switching audio input devices
- speaker volume control for remote participants

## 8.4 Moderation and Permissions

### 8.4.1 Waiting Room

The platform must support:
- waiting room enabled/disabled
- lobby counts
- admit flows
- synchronization of waiting state

### 8.4.2 Participant Controls

Moderator control surface must include:
- meeting lock state
- who can chat
- who can unmute
- who can turn on camera
- who can share screen
- kick / remove participant behavior where implemented

### 8.4.3 Enforcement

Client-side behavior must enforce permission changes promptly and avoid stale permission-trigger loops.

## 8.5 Whiteboard Collaboration

### 8.5.1 Functional Requirements

The whiteboard must support:
- open/close during a live meeting
- collaborative drawing sync
- persisted scene loading
- autosave
- lock/unlock behavior
- host/moderator control over editability
- fullscreen whiteboard mode
- participant viewport indicators
- filmstrip preview tile

### 8.5.2 Data Sync Model

Whiteboard state must sync via LiveKit data channels using:
- throttled scene updates
- lock-state broadcasts
- whiteboard activation broadcasts
- viewport broadcasts

### 8.5.3 Persistence Requirements

Whiteboard scene must be resilient to:
- panel close/reopen during a room session
- remote updates
- autosave delays

Scene should be kept both:
- in-memory during the meeting session
- persisted to backend storage

### 8.5.4 UX Expectations

Whiteboard preview tile must:
- reflect current rendered viewport, not only a full-scene export
- visually match actual scene/app state
- remain centered and scaled within the filmstrip tile

## 8.6 Chat and Polling

### 8.6.1 Chat Features

Chat must support:
- room chat messages
- typing indicators
- optional private-to-moderator chat
- history loading
- mention autocomplete
- timestamp display toggle

### 8.6.2 Poll Features

Chat/poll system should support:
- poll creation
- multiple options
- multiple-choice enablement
- vote submission
- poll close events

### 8.6.3 Draft Persistence Expectations

Transient chat draft state should be preserved across hide/reopen for usability.

## 8.7 Scheduling, History, Diagnostics, and Recordings

### 8.7.1 Scheduling

The platform must support:
- scheduled meeting creation
- host association
- recurrence metadata
- timezone tracking

### 8.7.2 Meeting History

The user should be able to view:
- prior meetings
- details for a meeting
- associated diagnostics or recordings if available

### 8.7.3 Diagnostics

The frontend must support:
- capturing network/quality data
- exporting diagnostics locally
- uploading diagnostics to backend

### 8.7.4 Recordings

The system should expose recording lifecycle/egress integration and recordings listing where configured.

## 8.8 Admin Console

The admin console must provide:
- dashboard summary
- users page
- meetings page
- audit logs page
- alerts page
- API keys page
- configuration/health/stats pages

Admin features must be role-protected and audit sensitive operations.

## 8.9 External Integration

The backend must support external access using API keys with:
- hashed key storage
- permission-scoped access
- activation/expiry support
- rate limiting

External consumers should be able to:
- create/access rooms
- request meeting tokens
- interact only within explicit permission boundaries

## 9. Data Model Requirements

## 9.1 Core Tables

The platform requires:
- `users`
- `rooms`
- `meetings`
- `meeting_participants`
- `scheduled_meetings`
- `refresh_tokens`

## 9.2 Collaboration / Platform Tables

Also required:
- `chat_messages`
- `whiteboards`
- `api_keys`
- `meeting_diagnostics`

## 9.3 Admin Tables

Also required:
- `admin_audit_logs`
- `admin_alerts`
- `user_activity`
- `system_settings`

## 10. API Requirements

## 10.1 Backend Route Groups

Required route groups:
- `/auth`
- `/rooms`
- `/token`
- `/meetings`
- `/egress`
- `/webhook/livekit`
- `/prashasakah`
- `/api-keys`
- `/external`
- `/health`

## 10.2 API Behavior Expectations

API must use:
- proper status codes
- role-aware authorization
- zod-based input validation
- safe client-facing error messages
- CORS origin allowlisting

## 11. Frontend State Requirements

## 11.1 Stores

The app requires centralized client state for:
- auth/session state
- room/meeting UI state
- chat state
- features state
- moderation/meeting control state

## 11.2 State Persistence Rules

The product should explicitly distinguish between:
- persisted user preferences
- current-room ephemeral state
- transient panel draft state

State must not silently reset in hide/reopen flows where the user expectation is continuity.

## 12. UI/UX Engineering Requirements

## 12.1 Layouts

The room UI must support:
- speaker layout
- grid layout
- screen-share layout
- whiteboard layout

## 12.2 Responsiveness

The frontend must work across:
- desktop browsers
- tablets
- mobile portrait
- mobile landscape

UI must account for:
- dynamic viewport height
- orientation changes
- browser chrome changes on mobile

## 12.3 Filmstrip Rules

Filmstrip design must:
- keep tiles visually aligned and centered
- scale gaps/padding relative to strip height
- use rounded tile geometry consistently
- avoid clipping, overflow, or unbalanced spacing

## 12.4 Overlay Rules

Tile overlays must avoid collisions among:
- participant title bar
- mic state icons
- raised-hand badge
- pin/fullscreen buttons
- quality indicators

Smaller tiles should automatically suppress nonessential overlay elements.

## 12.5 Preview Fidelity

Any preview surface should reflect the real applied state as closely as possible, including:
- whiteboard view
- blur/effects preview
- video fit mode
- layout/aspect ratio behavior

## 13. Security Requirements

The system must include:
- JWT secret enforcement
- refresh token hashing
- CSRF protection
- CORS enforcement
- auth and token rate limiting
- token invalidation on logout
- blacklist-before-cache auth evaluation
- API key permission checks
- audit logging for admin actions

## 14. Performance Requirements

The platform should:
- avoid unnecessary re-renders in participant-heavy views
- throttle whiteboard updates
- reuse whiteboard/blur resources where possible
- lazy-load large collaboration modules
- avoid polling where event-based behavior is preferable

## 15. Browser Support Requirements

Target support includes modern:
- Chrome
- Edge
- Firefox
- Safari
- mobile Chrome/Android WebView where possible
- mobile Safari/iOS

Feature degradation should be graceful for:
- background blur support
- insertable streams support
- GPU segmentation support

## 16. Testing Requirements

Testing should cover:
- backend API behavior
- auth/session flows
- room creation/join flows
- waiting room logic
- mobile responsive behavior
- whiteboard persistence/sync behavior
- chat/poll functionality
- role-based admin/moderator behaviors

The codebase currently supports automated browser and unit/integration testing patterns.

## 17. Deployment Requirements

Deployment must support:
- Linux-based hosts
- apt/dnf/yum/pacman ecosystems
- PostgreSQL service
- Redis/Valkey service
- LiveKit server service
- backend service
- frontend static hosting
- reverse proxy via Caddy or Nginx
- HTTPS via domain-based ACME or self-signed IP fallback
- firewall configuration for HTTP/HTTPS and LiveKit media ports

## 18. Observability and Operations

The system should expose:
- health endpoints
- backend logging
- LiveKit logging
- diagnostics export/upload
- admin health and stats views

## 19. Known Engineering Risks

1. Browser support differences for blur and segmentation pipelines.
2. Mobile secure-context requirements for media APIs.
3. Preview/UI mismatch if rendered state and stored state diverge.
4. Overlay crowding in small participant tiles.
5. Large frontend bundles from collaboration modules.
6. Subtle state-loss bugs when panels unmount/remount.

## 20. Engineering Priorities Going Forward

### Priority 1
- ensure every collaboration surface survives hide/reopen without visible loss
- ensure previews mirror live state
- keep mobile responsive behavior stable under viewport changes

### Priority 2
- improve settings semantics so “local”, “host default”, and “shared” are always explicit
- improve in-room diagnostics and observability
- reduce residual overlay collisions on very small tiles

### Priority 3
- expand admin analytics and recording workflows
- improve automated end-to-end coverage for whiteboard and media effects

## 21. Acceptance Criteria Summary

The product is considered engineering-complete for current scope when:

1. Users can register/login/logout and restore sessions safely.
2. Hosts can create/join/manage rooms reliably.
3. Participants can join from desktop and mobile browsers.
4. Waiting room, moderation, and permission controls behave consistently.
5. Whiteboard state survives normal open/close flows and syncs correctly.
6. Chat, mentions, typing, and polls behave correctly.
7. Admin console pages function under role protection.
8. Deployment is reproducible on common Linux setups.
9. UI previews match actual room behavior closely enough to avoid user confusion.
10. Known UX regressions like state loss, overlay collisions, and stale previews are minimized.
