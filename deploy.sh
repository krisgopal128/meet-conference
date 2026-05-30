#!/usr/bin/env bash
# =============================================================================
#  Meet Conference — Full-Stack Deployment Script
# =============================================================================
#
#  Supported distros: Ubuntu/Debian, Fedora/RHEL/CentOS, Arch/Manjaro
#  Package managers:  apt, dnf/yum, pacman
#
#  What this script does:
#    1. Detects your distro and package manager
#    2. Installs Node.js (22 LTS), PostgreSQL, Redis, LiveKit, Caddy
#    3. Creates database, user, runs schema + migrations
#    4. Builds backend (TypeScript) and frontend (React/Vite)
#    5. Configures Caddy reverse proxy with auto-HTTPS (Let's Encrypt)
#       or self-signed certs for IP-only setups
#    6. Installs systemd services for backend and LiveKit
#    7. Starts everything
#
#  Usage:
#    sudo bash deploy.sh                    # interactive, auto-detects config
#    sudo bash deploy.sh --domain meet.example.com --email admin@example.com
#    sudo bash deploy.sh --ip               # IP-only, self-signed HTTPS
#    sudo bash deploy.sh --ip --dir /opt/meet-conference --db-pass mysecretpass
#
#  Options:
#    --domain DOMAIN   Domain for Let's Encrypt auto-HTTPS
#    --email EMAIL     Email for Let's Encrypt registration
#    --ip              IP-only mode with self-signed HTTPS
#    --dir PATH        Project directory (auto-detected if omitted)
#    --db-name NAME    Database name (default: meetdb)
#    --db-user USER    Database user (default: meetapp)
#    --db-pass PASS    Database password (auto-generated if omitted)
#    -h, --help        Show full help
#
#  Requirements:
#    - Root or sudo access
#    - Internet access
#    - (Optional) A domain pointing to this server's IP for Let's Encrypt
#
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BLUE}  $*${NC}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ---------------------------------------------------------------------------
# Defaults — override with flags or interactive prompts
# ---------------------------------------------------------------------------
DOMAIN=""
EMAIL=""
IP_ONLY=false
PROJECT_DIR=""
DB_NAME="meetdb"
DB_USER="meetapp"
DB_PASS=""
REDIS_URL="redis://127.0.0.1:6379"
BACKEND_PORT=4000
LIVEKIT_VERSION="1.12.0"
NODE_MAJOR=22
DEPLOY_USER=""
SERVER_IP=""

# ---------------------------------------------------------------------------
# Parse flags
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain)  DOMAIN="$2";  shift 2 ;;
        --email)   EMAIL="$2";   shift 2 ;;
        --ip)      IP_ONLY=true; shift   ;;
        --dir)     PROJECT_DIR="$2"; shift 2 ;;
        --db-name) DB_NAME="$2"; shift 2 ;;
        --db-user) DB_USER="$2"; shift 2 ;;
        --db-pass) DB_PASS="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: sudo bash $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --domain DOMAIN   Domain name for Let's Encrypt (e.g. meet.example.com)"
            echo "  --email EMAIL     Email for Let's Encrypt registration"
            echo "  --ip              Use IP-only mode with self-signed HTTPS"
            echo "  --dir PATH        Project directory (auto-detected if omitted)"
            echo "  --db-name NAME    Database name (default: meetdb)"
            echo "  --db-user USER    Database user (default: meetapp)"
            echo "  --db-pass PASS    Database password (auto-generated if omitted)"
            echo "  -h, --help        Show this help"
            exit 0
            ;;
        *) error "Unknown option: $1"; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# Must be root
# ---------------------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root. Use: sudo bash $0"
    exit 1
fi

# ---------------------------------------------------------------------------
# Detect project directory
# ---------------------------------------------------------------------------
if [[ -z "$PROJECT_DIR" ]]; then
    SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "$SCRIPT_PATH/meet-backend/package.json" && -f "$SCRIPT_PATH/meet-frontend/package.json" ]]; then
        PROJECT_DIR="$SCRIPT_PATH"
    else
        error "Cannot find meet-backend/ and meet-frontend/ in $SCRIPT_PATH"
        error "Run this script from the meet-conference root, or use --dir /path/to/meet-conference"
        exit 1
    fi
fi

info "Project directory: $PROJECT_DIR"

# ---------------------------------------------------------------------------
# Detect the user who invoked sudo (to chown files later)
# ---------------------------------------------------------------------------
DEPLOY_USER="${SUDO_USER:-$(whoami)}"
if [[ "$DEPLOY_USER" == "root" ]]; then
    DEPLOY_USER="$(stat -c '%U' "$PROJECT_DIR" 2>/dev/null || echo 'root')"
fi
info "Deploy user: $DEPLOY_USER"

# ---------------------------------------------------------------------------
# Detect server IP
# ---------------------------------------------------------------------------
SERVER_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[\d.]+' || hostname -I 2>/dev/null | awk '{print $1}')"
if [[ -z "$SERVER_IP" ]]; then
    warn "Could not auto-detect server IP"
    SERVER_IP="0.0.0.0"
fi
info "Server IP: $SERVER_IP"

# ---------------------------------------------------------------------------
# Step 1: Detect distro and package manager
# ---------------------------------------------------------------------------
step "Step 1/8: Detecting system"

if [[ ! -f /etc/os-release ]]; then
    error "Cannot detect distribution (/etc/os-release missing)"
    exit 1
fi

source /etc/os-release

DISTRO_ID="$ID"
DISTRO_ID_LIKE="${ID_LIKE:-}"
DISTRO_NAME="$PRETTY_NAME"

info "Distro: $DISTRO_NAME"

PKG_MANAGER=""
install_pkg() { :; }
update_repos() { :; }

is_debian_like() { [[ "$DISTRO_ID" == "ubuntu" || "$DISTRO_ID" == "debian" || "$DISTRO_ID" == "raspbian" || "$DISTRO_ID_LIKE" == *"debian"* ]]; }
is_fedora_like() { [[ "$DISTRO_ID" == "fedora" || "$DISTRO_ID" == "rhel" || "$DISTRO_ID" == "centos" || "$DISTRO_ID" == "rocky" || "$DISTRO_ID" == "almalinux" || "$DISTRO_ID_LIKE" == *"fedora"* || "$DISTRO_ID_LIKE" == *"rhel"* ]]; }
is_arch_like()   { [[ "$DISTRO_ID" == "arch" || "$DISTRO_ID" == "manjaro" || "$DISTRO_ID" == "endeavouros" || "$DISTRO_ID_LIKE" == *"arch"* ]]; }

if is_debian_like; then
    PKG_MANAGER="apt"
    update_repos() { apt-get update -qq; }
    install_pkg() { apt-get install -y -qq "$@"; }
elif is_fedora_like; then
    PKG_MANAGER="dnf"
    update_repos() { dnf makecache --quiet 2>/dev/null || true; }
    install_pkg() { dnf install -y "$@"; }
elif is_arch_like; then
    PKG_MANAGER="pacman"
    update_repos() { pacman -Sy --noconfirm 2>/dev/null || true; }
    install_pkg() { pacman -S --noconfirm --needed "$@"; }
else
    if command -v yum &>/dev/null; then
        PKG_MANAGER="yum"
        update_repos() { yum makecache fast 2>/dev/null || true; }
        install_pkg() { yum install -y "$@"; }
    else
        error "Unsupported distribution: $DISTRO_NAME"
        error "Supported: Ubuntu/Debian, Fedora/RHEL/CentOS, Arch/Manjaro"
        exit 1
    fi
fi

info "Package manager: $PKG_MANAGER"

# Install basic utilities
install_pkg curl wget ca-certificates gnupg

# ---------------------------------------------------------------------------
# Step 2: Install Node.js
# ---------------------------------------------------------------------------
step "Step 2/8: Installing Node.js ${NODE_MAJOR}.x"

if command -v node &>/dev/null && [[ "$(node -v | cut -d. -f1)" == "v${NODE_MAJOR}" ]]; then
    info "Node.js $(node -v) already installed"
else
    info "Installing Node.js ${NODE_MAJOR}.x via ${PKG_MANAGER}..."

    if is_debian_like; then
        curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" -o /tmp/nodesource_setup.sh
        bash /tmp/nodesource_setup.sh
        apt-get install -y -qq nodejs
        rm -f /tmp/nodesource_setup.sh
    elif is_fedora_like; then
        curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" -o /tmp/nodesource_setup.sh
        bash /tmp/nodesource_setup.sh
        dnf install -y nodejs
        rm -f /tmp/nodesource_setup.sh
    elif is_arch_like; then
        pacman -S --noconfirm --needed nodejs npm
    fi
fi

info "Node.js: $(node -v)  npm: $(npm -v)"

# ---------------------------------------------------------------------------
# Step 3: Install PostgreSQL
# ---------------------------------------------------------------------------
step "Step 3/8: Installing PostgreSQL"

if command -v psql &>/dev/null; then
    info "PostgreSQL already installed: $(psql --version | head -1)"
else
    info "Installing PostgreSQL..."

    if is_debian_like; then
        install_pkg postgresql postgresql-contrib
    elif is_fedora_like; then
        install_pkg postgresql-server postgresql-contrib
        postgresql-setup --initdb 2>/dev/null || true
        if ! grep -q "host.*all.*all.*127.0.0.1/32.*md5" /var/lib/pgsql/data/pg_hba.conf 2>/dev/null; then
            sed -i 's|host\s\+all\s\+all\s\+127.0.0.1/32\s\+ident|host    all             all             127.0.0.1/32            md5|' /var/lib/pgsql/data/pg_hba.conf 2>/dev/null || true
        fi
    elif is_arch_like; then
        pacman -S --noconfirm --needed postgresql
        if [[ ! -d /var/lib/postgres/data ]]; then
            su - postgres -c "initdb -D /var/lib/postgres/data" 2>/dev/null || true
        fi
        {
            echo "local   all   all   trust"
            echo "host    all   all   127.0.0.1/32   md5"
            echo "host    all   all   ::1/128        md5"
        } > /var/lib/postgres/data/pg_hba.conf
    fi
fi

systemctl enable postgresql 2>/dev/null || true
systemctl start postgresql   2>/dev/null || true

# ---------------------------------------------------------------------------
# Step 4: Install Redis
# ---------------------------------------------------------------------------
step "Step 4/8: Installing Redis"

if command -v redis-cli &>/dev/null || command -v valkey-cli &>/dev/null; then
    info "Redis/Valkey already installed"
else
    info "Installing Redis..."

    if is_debian_like; then
        curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg 2>/dev/null || true
        echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs 2>/dev/null || echo "noble") main" \
            > /etc/apt/sources.list.d/redis.list 2>/dev/null || true
        apt-get update -qq 2>/dev/null || true
        apt-get install -y -qq redis 2>/dev/null || apt-get install -y -qq redis-server
        systemctl enable --now redis-server 2>/dev/null || true
    elif is_fedora_like; then
        dnf install -y redis
        systemctl enable --now redis
    elif is_arch_like; then
        pacman -S --noconfirm --needed redis
        systemctl enable --now redis
    fi
fi

if redis-cli ping &>/dev/null 2>&1; then
    info "Redis: running (PONG)"
else
    warn "Redis not responding, attempting to start..."
    systemctl start redis-server 2>/dev/null || systemctl start redis 2>/dev/null || true
    sleep 1
    if redis-cli ping &>/dev/null 2>&1; then
        info "Redis: running (PONG)"
    else
        error "Redis failed to start. Check: systemctl status redis"
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# Step 5: Install LiveKit
# ---------------------------------------------------------------------------
step "Step 5/8: Installing LiveKit Server v${LIVEKIT_VERSION}"

if command -v livekit-server &>/dev/null; then
    info "LiveKit already installed: $(livekit-server --version 2>&1 || echo 'unknown')"
else
    ARCH="$(uname -m)"
    case "$ARCH" in
        x86_64)  LK_ARCH="amd64" ;;
        aarch64) LK_ARCH="arm64" ;;
        *)       error "Unsupported architecture: $ARCH"; exit 1 ;;
    esac

    info "Downloading LiveKit v${LIVEKIT_VERSION} for linux_${LK_ARCH}..."
    curl -sSL "https://github.com/livekit/livekit/releases/download/v${LIVEKIT_VERSION}/livekit-server_${LIVEKIT_VERSION}_linux_${LK_ARCH}.tar.gz" \
        -o /tmp/livekit.tar.gz
    tar -xzf /tmp/livekit.tar.gz -C /tmp livekit-server
    mv /tmp/livekit-server /usr/local/bin/livekit-server
    chmod +x /usr/local/bin/livekit-server
    rm -f /tmp/livekit.tar.gz

    info "LiveKit installed: $(livekit-server --version 2>&1 || echo 'ok')"
fi

# ---------------------------------------------------------------------------
# Step 6: Install Caddy
# ---------------------------------------------------------------------------
step "Step 6/8: Installing Caddy"

if command -v caddy &>/dev/null; then
    info "Caddy already installed: $(caddy version 2>&1 || echo 'unknown')"
else
    info "Installing Caddy..."

    if is_debian_like; then
        apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https 2>/dev/null || true
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
            | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null || true
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
            | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
        chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null || true
        chmod o+r /etc/apt/sources.list.d/caddy-stable.list 2>/dev/null || true
        apt-get update -qq 2>/dev/null || true
        apt-get install -y -qq caddy
    elif is_fedora_like; then
        dnf install -y dnf-plugins-core 2>/dev/null || true
        dnf copr enable -y @caddy/caddy 2>/dev/null || true
        dnf install -y caddy
    elif is_arch_like; then
        pacman -S --noconfirm --needed caddy
    fi
fi

# ---------------------------------------------------------------------------
# Step 7: Configure database
# ---------------------------------------------------------------------------
step "Step 7/8: Configuring database"

if [[ -z "$DB_PASS" ]]; then
    DB_PASS="$(openssl rand -base64 24 | tr -d '/+=\n' | head -c 32)"
    info "Generated database password"
fi

info "Database: ${DB_USER}@localhost/${DB_NAME}"

DB_EXISTS="$(su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\"" 2>/dev/null || echo "")"

if [[ "$DB_EXISTS" == "1" ]]; then
    info "Database '${DB_NAME}' already exists"
else
    su - postgres -c "psql -c \"CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';\"" 2>/dev/null || true
    su - postgres -c "psql -c \"CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};\"" 2>/dev/null || true
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};\"" 2>/dev/null || true
    info "Database '${DB_NAME}' and user '${DB_USER}' created"
fi

SCHEMA_FILE="$PROJECT_DIR/meet-backend/src/db/schema.sql"
if [[ -f "$SCHEMA_FILE" ]]; then
    TABLE_COUNT="$(PGPASSWORD="$DB_PASS" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo "0")"
    if [[ "$TABLE_COUNT" -gt 5 ]]; then
        info "Schema already applied ($TABLE_COUNT tables)"
    else
        info "Applying database schema..."
        PGPASSWORD="$DB_PASS" psql -U "$DB_USER" -d "$DB_NAME" -f "$SCHEMA_FILE" 2>&1 | tail -5
        info "Schema applied"
    fi
else
    warn "Schema file not found: $SCHEMA_FILE"
fi

MIGRATIONS_DIR="$PROJECT_DIR/meet-backend/migrations"
if [[ -d "$MIGRATIONS_DIR" ]]; then
    info "Applying migrations..."
    for mig in "$MIGRATIONS_DIR"/*.sql; do
        [[ -f "$mig" ]] || continue
        MIG_NAME="$(basename "$mig")"
        PGPASSWORD="$DB_PASS" psql -U "$DB_USER" -d "$DB_NAME" -f "$mig" 2>&1 | tail -1
    done
    info "Migrations applied"
fi

# ---------------------------------------------------------------------------
# Step 7b: Build backend and frontend
# ---------------------------------------------------------------------------
step "Step 7b: Building application"

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

info "Installing backend dependencies..."
cd "$PROJECT_DIR/meet-backend"
su - "$DEPLOY_USER" -c "cd '$PROJECT_DIR/meet-backend' && npm install --loglevel=error 2>&1" | tail -3
info "Building backend..."
su - "$DEPLOY_USER" -c "cd '$PROJECT_DIR/meet-backend' && npm run build 2>&1" | tail -5

info "Installing frontend dependencies..."
su - "$DEPLOY_USER" -c "cd '$PROJECT_DIR/meet-frontend' && npm install --loglevel=error 2>&1" | tail -3
info "Building frontend..."
su - "$DEPLOY_USER" -c "cd '$PROJECT_DIR/meet-frontend' && npm run build 2>&1" | tail -5

BACKEND_DIST="$PROJECT_DIR/meet-backend/dist"
FRONTEND_DIST="$PROJECT_DIR/meet-frontend/dist"

if [[ ! -d "$BACKEND_DIST" ]]; then
    error "Backend build failed — dist/ not found"
    exit 1
fi
if [[ ! -d "$FRONTEND_DIST" ]]; then
    error "Frontend build failed — dist/ not found"
    exit 1
fi

info "Build complete"

# ---------------------------------------------------------------------------
# Step 7c: Generate LiveKit keys and config
# ---------------------------------------------------------------------------
step "Step 7c: Configuring LiveKit"

LK_KEYS="$(livekit-server generate-keys 2>&1 || true)"
LK_API_KEY="$(echo "$LK_KEYS" | grep -i 'api key' | awk '{print $NF}')"
LK_API_SECRET="$(echo "$LK_KEYS" | grep -i 'api secret' | awk '{print $NF}')"

if [[ -z "$LK_API_KEY" || -z "$LK_API_SECRET" ]]; then
    LK_API_KEY="API$(openssl rand -hex 6 | head -c 10)"
    LK_API_SECRET="$(openssl rand -hex 32)"
fi

LK_CONFIG="/etc/livekit.yaml"
cat > "$LK_CONFIG" << LKEOF
port: 7880
prometheus_port: 6798

keys:
  ${LK_API_KEY}: ${LK_API_SECRET}

room:
  auto_create: true
  empty_timeout: 300
  departure_timeout: 60
  max_participants: 100

logging:
  level: info
  json: false

redis:
  address: 127.0.0.1:6379

rtc:
  use_external_ip: true
  node_ip: ${SERVER_IP}
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
LKEOF

chmod 600 "$LK_CONFIG"
info "LiveKit config written to $LK_CONFIG"
info "API Key: ${LK_API_KEY}"

# ---------------------------------------------------------------------------
# Step 7d: Generate JWT secret
# ---------------------------------------------------------------------------
JWT_SECRET="$(openssl rand -hex 32)"

# ---------------------------------------------------------------------------
# Step 7e: Write backend .env
# ---------------------------------------------------------------------------
step "Step 7d: Writing environment files"

if [[ -n "$DOMAIN" ]]; then
    ORIGIN="https://${DOMAIN}"
    LIVEKIT_URL="wss://${DOMAIN}/livekit"
    FRONTEND_URL="https://${DOMAIN}"
else
    ORIGIN="https://${SERVER_IP}"
    LIVEKIT_URL="wss://${SERVER_IP}/livekit"
    FRONTEND_URL="https://${SERVER_IP}"
fi

cat > "$PROJECT_DIR/meet-backend/.env" << ENVEOF
NODE_ENV=production
LOG_LEVEL=info
PORT=${BACKEND_PORT}
FRONTEND_URL=${FRONTEND_URL}

LIVEKIT_URL=${LIVEKIT_URL}
LIVEKIT_API_KEY=${LK_API_KEY}
LIVEKIT_API_SECRET=${LK_API_SECRET}

DATABASE_URL=${DATABASE_URL}

REDIS_URL=${REDIS_URL}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

ALLOWED_ORIGINS=${ORIGIN}
ENVEOF

chmod 600 "$PROJECT_DIR/meet-backend/.env"
info "Backend .env written"

cat > "$PROJECT_DIR/meet-frontend/.env" << FEEOF
VITE_API_URL=/api
VITE_LIVEKIT_URL=${LIVEKIT_URL}
FEEOF

info "Frontend .env written"

# Rebuild frontend with new env vars
info "Rebuilding frontend with production env..."
su - "$DEPLOY_USER" -c "cd '$PROJECT_DIR/meet-frontend' && npm run build 2>&1" | tail -3

# ---------------------------------------------------------------------------
# Step 7f: Copy frontend dist to web root
# ---------------------------------------------------------------------------
WEB_ROOT="/var/www/meet-conference"
rm -rf "$WEB_ROOT"
cp -r "$FRONTEND_DIST" "$WEB_ROOT"
chown -R caddy:caddy "$WEB_ROOT" 2>/dev/null || chown -R www-data:www-data "$WEB_ROOT" 2>/dev/null || true
info "Frontend static files copied to $WEB_ROOT"

# Copy selfie segmentation model for background blur
mkdir -p "$WEB_ROOT/models"
if [[ -f "$PROJECT_DIR/meet-frontend/public/models/selfie_segmenter.tflite" ]]; then
    cp "$PROJECT_DIR/meet-frontend/public/models/selfie_segmenter.tflite" "$WEB_ROOT/models/"
    info "Blur model copied"
fi

# ---------------------------------------------------------------------------
# Step 8: Configure systemd services
# ---------------------------------------------------------------------------
step "Step 8/8: Installing services"

# --- Backend systemd service ---
cat > /etc/systemd/system/meet-backend.service << BEOF
[Unit]
Description=Meet Conference Backend API
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=${DEPLOY_USER}
WorkingDirectory=${PROJECT_DIR}/meet-backend
ExecStart=$(which node) dist/index.js
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

Environment=NODE_ENV=production
EnvironmentFile=${PROJECT_DIR}/meet-backend/.env

StandardOutput=journal
StandardError=journal
SyslogIdentifier=meet-backend

[Install]
WantedBy=multi-user.target
BEOF

# --- LiveKit systemd service ---
cat > /etc/systemd/system/livekit.service << LKEOF
[Unit]
Description=LiveKit Media Server
After=network.target redis.service
Wants=redis.service

[Service]
Type=simple
ExecStart=/usr/local/bin/livekit-server --config /etc/livekit.yaml
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

StandardOutput=journal
StandardError=journal
SyslogIdentifier=livekit

[Install]
WantedBy=multi-user.target
LKEOF

systemctl daemon-reload

# ---------------------------------------------------------------------------
# Configure Caddy
# ---------------------------------------------------------------------------
step "Configuring Caddy reverse proxy"

CADDYFILE="/etc/caddy/Caddyfile"

if [[ -n "$DOMAIN" ]]; then
    info "Setting up Caddy with automatic HTTPS for ${DOMAIN}"
    cat > "$CADDYFILE" << CEOF
{
    email ${EMAIL:-admin@${DOMAIN}}
}

${DOMAIN} {
    handle /api/* {
        uri strip_prefix /api
        reverse_proxy localhost:${BACKEND_PORT} {
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    handle /livekit/* {
        uri strip_prefix /livekit
        reverse_proxy localhost:7880 {
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    handle {
        root * ${WEB_ROOT}
        try_files {path} /index.html
        file_server

        @static path *.js *.css *.png *.jpg *.jpeg *.gif *.svg *.ico *.woff *.woff2 *.ttf *.eot
        header @static Cache-Control "public, max-age=31536000, immutable"
    }

    log {
        output file /var/log/caddy/meet-conference.log
    }
}
CEOF
else
    info "Setting up Caddy with self-signed HTTPS for IP ${SERVER_IP}"

    CERT_DIR="/etc/caddy/certs"
    mkdir -p "$CERT_DIR"

    openssl req -x509 -newkey rsa:2048 \
        -keyout "$CERT_DIR/server.key" \
        -out "$CERT_DIR/server.crt" \
        -days 3650 -nodes \
        -subj "/CN=${SERVER_IP}" \
        -addext "subjectAltName=IP:${SERVER_IP},IP:127.0.0.1,DNS:localhost" 2>/dev/null

    chmod 600 "$CERT_DIR/server.key"

    cat > "$CADDYFILE" << CEOF
{
    auto_https off
}

https://${SERVER_IP} {
    tls ${CERT_DIR}/server.crt ${CERT_DIR}/server.key

    handle /api/* {
        uri strip_prefix /api
        reverse_proxy localhost:${BACKEND_PORT} {
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    handle /livekit/* {
        uri strip_prefix /livekit
        reverse_proxy localhost:7880 {
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    handle {
        root * ${WEB_ROOT}
        try_files {path} /index.html
        file_server

        @static path *.js *.css *.png *.jpg *.jpeg *.gif *.svg *.ico *.woff *.woff2 *.ttf *.eot
        header @static Cache-Control "public, max-age=31536000, immutable"
    }

    log {
        output file /var/log/caddy/meet-conference.log
    }
}

http://${SERVER_IP} {
    redir https://${SERVER_IP}{uri} permanent
}
CEOF
fi

chown caddy:caddy "$CADDYFILE" 2>/dev/null || true
info "Caddyfile written to $CADDYFILE"

# ---------------------------------------------------------------------------
# Open firewall ports
# ---------------------------------------------------------------------------
step "Configuring firewall"

if command -v ufw &>/dev/null; then
    ufw --force allow 80/tcp    comment "HTTP"   2>/dev/null || true
    ufw --force allow 443/tcp   comment "HTTPS"  2>/dev/null || true
    ufw --force allow 7881/tcp  comment "LiveKit TCP" 2>/dev/null || true
    ufw --force allow 50000:60000/tcp comment "LiveKit RTC TCP" 2>/dev/null || true
    ufw --force allow 50000:60000/udp comment "LiveKit RTC UDP" 2>/dev/null || true
    info "UFW rules added"
elif command -v firewall-cmd &>/dev/null; then
    firewall-cmd --permanent --add-service=http  2>/dev/null || true
    firewall-cmd --permanent --add-service=https 2>/dev/null || true
    firewall-cmd --permanent --add-port=7881/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=50000-60000/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=50000-60000/udp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    info "firewalld rules added"
elif command -v iptables &>/dev/null; then
    iptables -A INPUT -p tcp --dport 80 -j ACCEPT  2>/dev/null || true
    iptables -A INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
    iptables -A INPUT -p tcp --dport 7881 -j ACCEPT 2>/dev/null || true
    iptables -A INPUT -p tcp --match multiport --dports 50000:60000 -j ACCEPT 2>/dev/null || true
    iptables -A INPUT -p udp --match multiport --dports 50000:60000 -j ACCEPT 2>/dev/null || true
    if command -v iptables-save &>/dev/null; then
        iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
    fi
    info "iptables rules added"
fi

# ---------------------------------------------------------------------------
# Start all services
# ---------------------------------------------------------------------------
step "Starting services"

systemctl restart livekit
systemctl enable livekit
info "LiveKit: started"

systemctl restart meet-backend
systemctl enable meet-backend
info "Backend: started"

systemctl restart caddy
systemctl enable caddy
info "Caddy: started"

sleep 3

# ---------------------------------------------------------------------------
# Verify services
# ---------------------------------------------------------------------------
step "Verification"

FAILED=false

if systemctl is-active --quiet livekit; then
    info "  LiveKit:    active (port 7880)"
else
    error "  LiveKit:    FAILED"
    FAILED=true
fi

if systemctl is-active --quiet meet-backend; then
    info "  Backend:    active (port ${BACKEND_PORT})"
else
    error "  Backend:    FAILED"
    FAILED=true
fi

if systemctl is-active --quiet caddy; then
    info "  Caddy:      active (port 443)"
else
    error "  Caddy:      FAILED"
    FAILED=true
fi

if systemctl is-active --quiet postgresql; then
    info "  PostgreSQL: active (port 5432)"
else
    error "  PostgreSQL: FAILED"
    FAILED=true
fi

if redis-cli ping &>/dev/null; then
    info "  Redis:      active (port 6379)"
else
    error "  Redis:      FAILED"
    FAILED=true
fi

if curl -sf "http://localhost:${BACKEND_PORT}/health" -o /dev/null 2>/dev/null; then
    info "  Backend health check: OK"
else
    warn "  Backend health check: no response (may need a few seconds to start)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================================================="
echo ""
if [[ "$FAILED" == "true" ]]; then
    echo -e "  ${RED}Some services failed to start. Check:${NC}"
    echo ""
    echo "    systemctl status livekit"
    echo "    systemctl status meet-backend"
    echo "    systemctl status caddy"
    echo "    journalctl -u meet-backend --no-pager -n 50"
    echo ""
fi

if [[ -n "$DOMAIN" ]]; then
    echo -e "  ${GREEN}Access your app at:${NC}  https://${DOMAIN}"
else
    echo -e "  ${GREEN}Access your app at:${NC}  https://${SERVER_IP}"
    echo -e "  ${YELLOW}(Self-signed cert — accept the browser warning)${NC}"
fi

echo ""
echo "  Admin commands:"
echo "    systemctl status meet-backend livekit caddy"
echo "    systemctl restart meet-backend"
echo "    journalctl -u meet-backend -f"
echo ""
echo "  Configuration files:"
echo "    Backend .env:    $PROJECT_DIR/meet-backend/.env"
echo "    LiveKit config:  /etc/livekit.yaml"
echo "    Caddyfile:       /etc/caddy/Caddyfile"
echo "    Frontend static: $WEB_ROOT"
echo ""
echo "  LiveKit credentials:"
echo "    API Key:    ${LK_API_KEY}"
echo "    API Secret: ${LK_API_SECRET}"
echo ""
echo "  Database:"
echo "    Host: localhost:5432"
echo "    Name: ${DB_NAME}"
echo "    User: ${DB_USER}"
echo "    Pass: ${DB_PASS}"
echo ""
echo "============================================================================="

if [[ "$FAILED" == "true" ]]; then
    exit 1
fi
