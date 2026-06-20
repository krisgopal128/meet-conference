# 🎥 Meet Conference

A real-time video conferencing platform built with React, Express, and LiveKit — a self-hosted Google Meet alternative.

![Version](https://img.shields.io/badge/frontend-1.0.6-blue)
![Version](https://img.shields.io/badge/backend-1.0.0-blue)
![LiveKit](https://img.shields.io/badge/LiveKit-1.10.0-green)

---

## ✨ Features

### Core Video Conferencing
- 📹 HD video & audio calls powered by LiveKit WebRTC
- 🖥️ Screen sharing with layout switching
- 💬 Real-time in-meeting chat
- 🎙️ Speaker detection & adaptive layout
- 🔇 Mute/unmute audio & video controls
- 📊 Network quality indicator
- 🔔 Join/leave sound notifications

### Meeting Management
- 📅 Schedule meetings with date, time & duration
- 🔗 Share meeting links (one-click copy)
- 📜 Meeting history with participant details & chat logs
- ✏️ Edit scheduled meetings
- 🚫 Cancel/delete meetings
- 🔄 Rejoin past meetings

### Roles & Permissions
- 👑 **Moderator**: Full control — admit/deny from lobby, kick participants, mute others, end meeting
- 👤 **Participant**: Join meetings, chat, share screen (if allowed)
- 🔒 Security hardening: CSRF protection, rate limiting, input sanitization, audit logging
- 🛡️ Role-based route protection

### Admin Panel (Prashasakah)
- 👥 User management (list, edit, delete)
- 📊 Dashboard with stats & charts
- 🗄️ Meeting oversight & audit logs
- 🔑 API key management for external integrations
- ⚠️ Alert system
- ⚙️ System settings

### Advanced Features
- 🖼️ **Picture-in-Picture** (Chrome 116+) — floating mini window with participant tiles
- 🎨 **Background Effects** — blur, solid color, image replacement, or passthrough (MediaPipe Selfie Segmentation, runs on-device)
- 🪞 **Camera Mirror** — toggle selfie-view mirroring on/off
- 🎤 **Voice Level Meter** — real-time microphone input indicator on PreJoin page
- 📐 Video fit mode sync (letterbox/crop) across participants
- 📱 Fully responsive — mobile-first design with bottom nav
- 🔐 JWT authentication with token refresh
- ⏱️ Remember me (30-day sessions)
- 📋 **Collaborative Whiteboard** — real-time drawing with Excalidraw, lock/unlock for moderators

### External API (SDK)
- REST API for third-party integrations
- API key authentication
- Room CRUD operations
- Teacher/student token generation
- Used by [Tuition Notebook](docs/tuition-notebook-integration.md) integration

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Caddy (Reverse Proxy)             │
│                  SSL termination (HTTPS)             │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌──────────────────┐
│   React Frontend │   │  Express Backend │
│   (Vite + TS)    │   │  (Node + TS)     │
│   Port: 5173     │   │  Port: 4000      │
└────────┬─────────┘   └──┬───┬───┬───────┘
         │                │   │   │
         │    ┌───────────┘   │   └──────────┐
         │    ▼               ▼              ▼
         │  ┌──────────┐ ┌──────────┐ ┌──────────┐
         └─►│ LiveKit  │ │PostgreSQL│ │  Redis   │
            │ Server   │ │          │ │          │
            │ Port:7880│ │ Port:5432│ │ Port:6379│
            └──────────┘ └──────────┘ └──────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Zustand |
| **Backend** | Express.js, TypeScript, Zod validation |
| **WebRTC** | LiveKit Server 1.10.0, LiveKit Client SDK |
| **Database** | PostgreSQL 16 |
| **Cache** | Redis |
| **Reverse Proxy** | Caddy (auto HTTPS) |
| **Auth** | JWT with bcrypt password hashing |
| **Testing** | Vitest (frontend & backend) |

---

## 📂 Project Structure

```
meet-conference/
├── meet-frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── components/     # UI components (chat, controls, room, pip, etc.)
│   │   ├── hooks/          # 38 custom React hooks
│   │   ├── pages/          # 15 pages (Home, Login, Room, Schedule, etc.)
│   │   ├── services/       # API client services
│   │   ├── store/          # Zustand state management (5 slices)
│   │   ├── types/          # TypeScript type definitions
│   │   ├── utils/          # Utilities (blur engine, aspect ratios, livekit data)
│   │   └── config/         # Meeting room configuration
│   └── public/
│       ├── models/         # MediaPipe selfie segmenter model
│       └── wasm/           # MediaPipe tasks-vision WASM runtime
│
├── meet-backend/           # Express + TypeScript backend
│   ├── src/
│   │   ├── routes/         # API routes (auth, rooms, roomsParticipants, roomsChat, external, webhook, etc.)
│   │   ├── services/       # Business logic (database, redis, participantPresence, livekit, webhookService, etc.)
│   │   ├── middleware/     # Auth, rate limiting, role checks
│   │   ├── db/             # Database schema
│   │   └── migrations/     # SQL migrations
│   └── scripts/            # Database seed scripts
│
├── livekit/                # LiveKit server configuration (template only)
├── docs/                   # Project documentation
├── start-meet.sh           # Service startup script
├── backup.sh               # Daily backup script
└── SETUP.md                # Full deployment guide
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (v23 recommended)
- PostgreSQL 14+
- Redis 6+
- LiveKit Server 1.9+

### 1. Clone & Install

```bash
git clone https://github.com/krisgopal128/meet-conference.git
cd meet-conference

# Install frontend dependencies
cd meet-frontend && npm install

# Install backend dependencies
cd ../meet-backend && npm install
```

### 2. Configure Environment Variables

```bash
# Frontend (.env)
cp meet-frontend/.env.example meet-frontend/.env
# Edit with your API and LiveKit WebSocket URLs

# Backend (.env)
cp meet-backend/.env.example meet-backend/.env
# Edit with your database, Redis, LiveKit, and JWT secrets
```

### 3. Set Up Database

```bash
# Create PostgreSQL database
createdb meetconference

# Run migrations
psql meetconference -f meet-backend/src/db/schema.sql
```

### 4. Start Services

```bash
# Option A: Use the startup script
./start-meet.sh

# Option B: Start manually
# Terminal 1 - Backend
cd meet-backend && npm run dev

# Terminal 2 - Frontend
cd meet-frontend && npm run dev
```

### 5. Access the App

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`
- Health check: `http://localhost:4000/health`

📖 For full deployment with HTTPS, see [SETUP.md](SETUP.md)

---

## 📱 Pages Overview

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Dashboard with upcoming meetings |
| Login | `/login` | User authentication |
| Register | `/register` | New account creation |
| Pre-Join | `/join/:roomName` | Camera/mic check before meeting |
| Meeting Room | `/room/:roomName` | Main video conference room |
| Schedule | `/schedule` | Schedule new meetings |
| History | `/history` | Past meeting history |
| Meeting Detail | `/history/:id` | Individual meeting details |
| API Keys | `/api-keys` | API key management (moderators) |
| Admin Panel | `/prashasakah/*` | Admin dashboard & management |

---

## 🧪 Testing

```bash
# Frontend tests
cd meet-frontend && npm test

# Backend tests
cd meet-backend && npm test

# Lint
npm run lint
```

---

## 🔒 Security

- All secrets managed via `.env` files (gitignored)
- JWT authentication with bcrypt password hashing
- Rate limiting on API endpoints
- CORS configured for allowed origins
- Input validation with Zod schemas
- SQL parameterized queries (no injection risk)

---

## 📄 License

Private repository. All rights reserved.

