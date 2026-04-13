# Meet Conference - Setup Guide

Complete step-by-step guide to deploy the Meet Conference platform from source.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Place Source Code](#2-place-source-code)
3. [Install Dependencies](#3-install-dependencies)
4. [Configure Environment Variables](#4-configure-environment-variables)
5. [Database Setup](#5-database-setup)
6. [LiveKit Setup](#6-livekit-setup)
7. [Caddy (HTTPS) Setup](#7-caddy-https-setup)
8. [Start Services](#8-start-services)
9. [Verify Everything Works](#9-verify-everything-works)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | v18+ (v23 recommended) | Runtime for frontend/backend |
| npm | v10+ | Package manager |
| PostgreSQL | v14+ | Database |
| Redis | v6+ | Session/cache management |
| LiveKit Server | v1.9+ | WebRTC video infrastructure |
| Caddy | v2+ | Reverse proxy with auto HTTPS |

### System Requirements

- **RAM**: 1GB minimum (4GB+ recommended for 50+ participants)
- **CPU**: 2 cores minimum (4+ recommended)
- **Disk**: 10GB+ free space
- **OS**: Linux (Ubuntu/Debian recommended)

### Network Requirements

- **Ports to open**:
  - `80` (HTTP - for Let's Encrypt)
  - `443` (HTTPS)
  - `7880` (LiveKit HTTP API)
  - `50000-60000/udp` (WebRTC media)
  - `5173` (Vite dev server - optional, for development)
  - `4000` (Backend API - optional, for development)

---

## 2. Place Source Code

```bash
# Clone or copy the project to your desired location
cd /home/jspace
# Option A: Clone from git
git clone <your-repo-url> meet-conference

# Option B: Copy existing folder
cp -r /path/to/meet-conference /home/jspace/meet-conference

cd meet-conference
```

### Project Structure

```
meet-conference/
├── livekit/              # LiveKit server configuration
│   └── livekit.yaml
├── meet-backend/         # Express API server
│   ├── src/
│   ├── package.json
│   └── .env
├── meet-frontend/        # React + Vite frontend
│   ├── src/
│   ├── package.json
│   └── .env
├── start-meet.sh         # Startup script
├── backup.sh             # Database backup script
└── SETUP.md              # This file
```

---

## 3. Install Dependencies

### Install Node.js (using nvm)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install Node.js
nvm install 23
nvm use 23
nvm alias default 23

# Verify
node --version   # Should show v23.x.x
npm --version    # Should show 10.x.x
```

### Install Backend Dependencies

```bash
cd /home/jspace/meet-conference/meet-backend
npm install
```

### Install Frontend Dependencies

```bash
cd /home/jspace/meet-conference/meet-frontend
npm install
```

### Install System Services

```bash
# PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib -y
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Redis
sudo apt install redis-server -y
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Caddy (Debian/Ubuntu)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy -y

# LiveKit
curl -sSL https://github.com/livekit/livekit/releases/latest/download/livekit-server-linux-amd64.tar.gz | sudo tar xz -C /usr/local/bin livekit-server
sudo chmod +x /usr/local/bin/livekit-server
```

---

## 4. Configure Environment Variables

### Backend (.env)

Create `/home/jspace/meet-conference/meet-backend/.env`:

```bash
# Server
PORT=4000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://meetapp:YOUR_DB_PASSWORD@localhost:5432/meetdb

# JWT
JWT_SECRET=YOUR_JWT_SECRET_HERE
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# LiveKit
LIVEKIT_API_KEY=YOUR_LIVEKIT_API_KEY
LIVEKIT_API_SECRET=YOUR_LIVEKIT_API_SECRET
LIVEKIT_URL=wss://livekit.yourdomain.com

# Redis
REDIS_URL=redis://localhost:6379

# Frontend URL (for CORS)
FRONTEND_URL=https://meet.yourdomain.com
```

### Frontend (.env)

Create `/home/jspace/meet-conference/meet-frontend/.env`:

```bash
# API URL (relative path, proxied through Caddy)
VITE_API_URL=/api

# LiveKit WebSocket URL
VITE_LIVEKIT_URL=wss://livekit.yourdomain.com
```

### Generate Secrets

```bash
# Generate JWT Secret (32+ bytes)
openssl rand -base64 32

# Generate DB Password
openssl rand -hex 24

# Generate LiveKit API Key/Secret (or use livekit-cli generate-keys)
livekit-server --generate-keys
```

---

## 5. Database Setup

### Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# In psql shell:
CREATE USER meetapp WITH PASSWORD 'YOUR_DB_PASSWORD';
CREATE DATABASE meetdb OWNER meetapp;
GRANT ALL PRIVILEGES ON DATABASE meetdb TO meetapp;
\q
```

### Run Migrations

```bash
cd /home/jspace/meet-conference/meet-backend

# Run all migrations
npm run db:migrate

# Or manually:
psql -U meetapp -d meetdb -f src/db/migrations/001_add_chat_messages.sql
psql -U meetapp -d meetdb -f src/db/migrations/002_add_performance_indexes.sql
# ... etc
```

### (Optional) Seed Mock Data

```bash
# For development/testing
psql -U meetapp -d meetdb -f scripts/seed-mock-data.sql
```

---

## 6. LiveKit Setup

### Create livekit.yaml

Create `/home/jspace/meet-conference/livekit/livekit.yaml`:

```yaml
# LiveKit Server Configuration
port: 7880
prometheus_port: 6798

# API Keys
keys:
  YOUR_API_KEY: YOUR_API_SECRET

# Room settings
room:
  auto_create: true
  empty_timeout: 300
  max_participants: 100

# Logging
logging:
  level: info
  json: false

# Redis for room management
redis:
  address: 127.0.0.1:6379

# RTC settings
rtc:
  use_external_ip: true
```

### Create systemd Service

Create `/etc/systemd/system/livekit.service`:

```ini
[Unit]
Description=LiveKit WebRTC Server
After=network.target

[Service]
Type=simple
User=jspace
WorkingDirectory=/home/jspace/meet-conference
ExecStart=/usr/local/bin/livekit-server --config /home/jspace/meet-conference/livekit/livekit.yaml
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable livekit
sudo systemctl start livekit
sudo systemctl status livekit
```

---

## 7. Caddy (HTTPS) Setup

### Create Caddyfile

Create `/etc/caddy/Caddyfile`:

```caddy
# Global options
{
    email your-email@example.com
    acme_ca https://acme-v02.api.letsencrypt.org/directory
}

# LiveKit WebSocket endpoint
livekit.yourdomain.com {
    reverse_proxy localhost:7880 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}

# Meet app - frontend + backend API on same domain
meet.yourdomain.com {
    # Define API path matcher
    @api {
        path /auth* /token* /rooms* /meetings* /egress* /webhook*
    }
    
    # API routes go to Express backend
    handle @api {
        reverse_proxy localhost:4000
    }
    
    # Everything else goes to React frontend
    handle {
        reverse_proxy localhost:5173
    }
}
```

### Start Caddy

```bash
# Validate config
sudo caddy validate --config /etc/caddy/Caddyfile

# Start Caddy
sudo systemctl enable caddy
sudo systemctl start caddy
sudo systemctl status caddy
```

### DNS Configuration

Point these domains to your server IP:

| Subdomain | Type | Target |
|-----------|------|--------|
| `livekit.yourdomain.com` | A | YOUR_SERVER_IP |
| `meet.yourdomain.com` | A | YOUR_SERVER_IP |

---

## 8. Start Services

### Option A: Using the Startup Script

```bash
cd /home/jspace/meet-conference
chmod +x start-meet.sh

# Start all services
./start-meet.sh

# Check status
./start-meet.sh --status

# View logs
./start-meet.sh logs

# Stop all services
./start-meet.sh --stop

# Restart all services
./start-meet.sh --restart
```

### Option B: Manual Start

```bash
# 1. Start PostgreSQL (if not running)
sudo systemctl start postgresql

# 2. Start Redis (if not running)
sudo systemctl start redis-server

# 3. Start LiveKit
sudo systemctl start livekit

# 4. Start Caddy
sudo systemctl start caddy

# 5. Build and start Backend
cd /home/jspace/meet-conference/meet-backend
npm run build
npm run start &

# 6. Start Frontend (development mode)
cd /home/jspace/meet-conference/meet-frontend
npm run dev &

# OR for production build:
cd /home/jspace/meet-conference/meet-frontend
npm run build
npm run preview -- --port 5173 &
```

---

## 9. Verify Everything Works

### Check Service Status

```bash
# PostgreSQL
sudo systemctl status postgresql

# Redis
redis-cli ping   # Should return PONG

# LiveKit
curl http://localhost:7880   # Should return LiveKit info

# Backend API
curl http://localhost:4000/health   # Or any endpoint

# Frontend
curl http://localhost:5173   # Should return HTML

# Caddy (HTTPS)
curl https://meet.yourdomain.com
```

### Test Login

1. Open `https://meet.yourdomain.com` in browser
2. Login with credentials:
   - **Email**: `kris@phuket-tourist.com` (if mock data seeded)
   - **Password**: `demo123`
3. You should see rooms and meetings

### Check API Endpoints

```bash
# Get auth token
TOKEN=$(curl -s -X POST https://meet.yourdomain.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"kris@phuket-tourist.com","password":"demo123"}' | jq -r '.token')

# Test rooms endpoint
curl -s https://meet.yourdomain.com/rooms \
  -H "Authorization: Bearer $TOKEN"

# Test meetings endpoint
curl -s "https://meet.yourdomain.com/meetings?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 10. Troubleshooting

### Common Issues

#### Backend won't start

```bash
# Check if port 4000 is in use
lsof -i :4000
kill -9 <PID>

# Check database connection
psql -U meetapp -d meetdb -c "SELECT 1;"

# Check logs
tail -f /home/jspace/meet-conference/logs/backend.log
```

#### Frontend shows blank page

```bash
# Check if Vite is running
lsof -i :5173

# Check browser console for errors
# Hard refresh: Ctrl+Shift+R

# Verify environment variables
cat /home/jspace/meet-conference/meet-frontend/.env
```

#### API returns 404

```bash
# Check Caddy routing
sudo caddy validate --config /etc/caddy/Caddyfile

# Check Caddy logs
sudo journalctl -u caddy -f

# Test direct backend access
curl http://localhost:4000/rooms
```

#### LiveKit connection fails

```bash
# Check LiveKit status
sudo systemctl status livekit

# Check LiveKit logs
sudo journalctl -u livekit -f

# Verify LiveKit config
cat /home/jspace/meet-conference/livekit/livekit.yaml

# Test LiveKit directly
curl http://localhost:7880
```

#### Database connection errors

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -U meetapp -d meetdb -c "SELECT 1;"

# Check pg_hba.conf if auth fails
sudo cat /etc/postgresql/*/main/pg_hba.conf
```

#### HTTPS/SSL issues

```bash
# Check Caddy logs
sudo journalctl -u caddy -f

# Force certificate renewal
sudo caddy reload --config /etc/caddy/Caddyfile

# Check DNS resolution
dig livekit.yourdomain.com
dig meet.yourdomain.com
```

### Log Locations

| Service | Log Location |
|---------|--------------|
| Backend | `/home/jspace/meet-conference/logs/backend.log` |
| Frontend | `/home/jspace/meet-conference/logs/frontend.log` |
| LiveKit | `sudo journalctl -u livekit` |
| Caddy | `sudo journalctl -u caddy` |
| PostgreSQL | `/var/log/postgresql/` |
| Redis | `/var/log/redis/` |

### Reset Everything

```bash
# Stop all services
./start-meet.sh --stop

# Kill any remaining processes
pkill -f "node.*meet"
pkill -f "vite"

# Restart services
sudo systemctl restart postgresql redis-server livekit caddy

# Start app
./start-meet.sh
```

---

## Quick Reference

### Start Command Sequence

```bash
# 1. Ensure services running
sudo systemctl start postgresql redis-server livekit caddy

# 2. Start the app
cd /home/jspace/meet-conference && ./start-meet.sh

# 3. Verify
curl https://meet.yourdomain.com
```

### Stop Command Sequence

```bash
cd /home/jspace/meet-conference && ./start-meet.sh --stop
```

### Update & Restart

```bash
cd /home/jspace/meet-conference
git pull  # if using git
./start-meet.sh --restart
```

---

## Demo Credentials

After seeding mock data:

- **Email**: `kris@phuket-tourist.com`
- **Password**: `demo123`

---

## Support

If issues persist:
1. Check logs in `/home/jspace/meet-conference/logs/`
2. Run `./start-meet.sh --status` for service health
3. Verify all environment variables are set correctly
4. Ensure DNS is properly configured

---

*Last updated: 2026-03-13*
