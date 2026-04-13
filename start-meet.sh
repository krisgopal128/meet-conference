#!/bin/bash
#
# Meet Conference - Service Startup Script
# ========================================
# Starts backend and frontend services with:
# - Pre-flight dependency checks
# - Automatic port conflict resolution
# - Graceful shutdown handling
# - Color-coded logging
#
# Usage:
#   ./start-meet.sh           # Start services
#   ./start-meet.sh --stop    # Stop services
#   ./start-meet.sh --status  # Check status
#   ./start-meet.sh --restart # Restart services
#

set -euo pipefail

# ============================================
# NVM SETUP (must be done first)
# ============================================
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# ============================================
# CONFIGURATION
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/meet-backend"
FRONTEND_DIR="$SCRIPT_DIR/meet-frontend"
LOG_DIR="$SCRIPT_DIR/logs"

# Ports
BACKEND_PORT=4000
FRONTEND_PORT=5173

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================
# LOGGING FUNCTIONS
# ============================================
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        INFO)  echo -e "${CYAN}[INFO]${NC}  $message" ;;
        OK)    echo -e "${GREEN}[OK]${NC}    $message" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC}  $message" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $message" ;;
        STEP)  echo -e "${BLUE}[STEP]${NC}  $message" ;;
    esac
    
    # Also write to log file
    mkdir -p "$LOG_DIR"
    echo "[$timestamp] [$level] $message" >> "$LOG_DIR/startup.log"
}

banner() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     Meet Conference Service Manager        ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
    echo ""
}

# ============================================
# HELPER FUNCTIONS
# ============================================

# Check if a port is in use
is_port_in_use() {
    local port=$1
    ss -tlnp 2>/dev/null | grep -q ":$port " || lsof -i ":$port" >/dev/null 2>&1
}

# Get PID using a port
get_pid_on_port() {
    local port=$1
    ss -tlnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1
}

# Kill process on port with graceful shutdown
kill_port() {
    local port=$1
    local service_name=$2
    
    if is_port_in_use "$port"; then
        local pid=$(get_pid_on_port "$port")
        if [ -n "$pid" ]; then
            log WARN "Port $port is in use by PID $pid ($service_name)"
            log STEP "Sending SIGTERM to $pid..."
            
            # Try graceful shutdown first
            kill -TERM "$pid" 2>/dev/null || true
            
            # Wait up to 10 seconds for graceful shutdown
            local waited=0
            while [ $waited -lt 10 ]; do
                if ! kill -0 "$pid" 2>/dev/null; then
                    log OK "Process $pid terminated gracefully"
                    return 0
                fi
                sleep 1
                ((waited++))
            done
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                log WARN "Process $pid didn't stop, sending SIGKILL..."
                kill -KILL "$pid" 2>/dev/null || true
                sleep 1
            fi
            
            log OK "Port $port freed"
        fi
    fi
}

# Wait for a service to be ready
wait_for_service() {
    local port=$1
    local service_name=$2
    local max_wait=30
    local url="http://localhost:$port/health"
    
    log STEP "Waiting for $service_name to be ready..."
    
    local waited=0
    while [ $waited -lt $max_wait ]; do
        if curl -sf "$url" >/dev/null 2>&1; then
            log OK "$service_name is ready!"
            return 0
        fi
        sleep 1
        ((waited++))
        printf "."
    done
    echo ""
    
    log ERROR "$service_name failed to start within ${max_wait}s"
    return 1
}

# Check system dependencies
check_dependencies() {
    log STEP "Checking system dependencies..."
    local missing=()
    
    # Check Node.js (nvm already sourced)
    if ! command -v node &>/dev/null; then
        missing+=("node")
    else
        log OK "Node.js $(node --version) found"
    fi
    
    # Check npm
    if ! command -v npm &>/dev/null; then
        missing+=("npm")
    else
        log OK "npm $(npm --version) found"
    fi
    
    # Check PostgreSQL
    if ! systemctl is-active --quiet postgresql 2>/dev/null; then
        log WARN "PostgreSQL not running. Attempting to start..."
        sudo systemctl start postgresql 2>/dev/null || missing+=("postgresql")
    else
        log OK "PostgreSQL is running"
    fi
    
    # Check Redis
    if ! systemctl is-active --quiet redis-server 2>/dev/null && ! systemctl is-active --quiet redis 2>/dev/null; then
        log WARN "Redis not running. Attempting to start..."
        sudo systemctl start redis-server 2>/dev/null || sudo systemctl start redis 2>/dev/null || missing+=("redis")
    else
        log OK "Redis is running"
    fi
    
    # Check ss or lsof
    if ! command -v ss &>/dev/null && ! command -v lsof &>/dev/null; then
        missing+=("ss or lsof")
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        log ERROR "Missing dependencies: ${missing[*]}"
        log ERROR "Please install them and try again."
        return 1
    fi
    
    return 0
}

# Check project dependencies (node_modules)
check_project_deps() {
    log STEP "Checking project dependencies..."
    
    if [ ! -d "$BACKEND_DIR/node_modules" ]; then
        log WARN "Backend dependencies not installed. Running npm install..."
        (cd "$BACKEND_DIR" && npm install)
    else
        log OK "Backend dependencies installed"
    fi
    
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        log WARN "Frontend dependencies not installed. Running npm install..."
        (cd "$FRONTEND_DIR" && npm install)
    else
        log OK "Frontend dependencies installed"
    fi
}

# ============================================
# SERVICE FUNCTIONS
# ============================================

start_backend() {
    log STEP "Starting Backend (port $BACKEND_PORT)..."
    
    # Kill any existing process on the port
    kill_port "$BACKEND_PORT" "backend"
    
    # Build if needed
    if [ ! -d "$BACKEND_DIR/dist" ] || [ "$BACKEND_DIR/src/index.ts" -nt "$BACKEND_DIR/dist/index.js" ]; then
        log INFO "Building backend..."
        (cd "$BACKEND_DIR" && npm run build)
    fi
    
    # Start in background
    cd "$BACKEND_DIR"
    nohup node dist/index.js > "$LOG_DIR/backend.log" 2>&1 &
    local pid=$!
    echo $pid > "$LOG_DIR/backend.pid"
    cd - > /dev/null
    
    log INFO "Backend started with PID $pid"
    
    # Wait for it to be ready
    if wait_for_service "$BACKEND_PORT" "Backend"; then
        return 0
    else
        log ERROR "Backend failed to start. Check logs: $LOG_DIR/backend.log"
        return 1
    fi
}

start_frontend() {
    log STEP "Starting Frontend (port $FRONTEND_PORT)..."
    
    # Kill any existing process on the port
    kill_port "$FRONTEND_PORT" "frontend"
    
    # Start in background
    cd "$FRONTEND_DIR"
    nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
    local pid=$!
    echo $pid > "$LOG_DIR/frontend.pid"
    cd - > /dev/null
    
    log INFO "Frontend started with PID $pid"
    
    # Wait for Vite to be ready (check for HTTP 200)
    log STEP "Waiting for Frontend to be ready..."
    local waited=0
    while [ $waited -lt 20 ]; do
        if curl -sf "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
            log OK "Frontend is ready!"
            return 0
        fi
        sleep 1
        ((waited++))
    done
    
    log ERROR "Frontend failed to start within 20s. Check logs: $LOG_DIR/frontend.log"
    return 1
}

stop_services() {
    log STEP "Stopping services..."
    
    # Stop backend
    if [ -f "$LOG_DIR/backend.pid" ]; then
        local pid=$(cat "$LOG_DIR/backend.pid")
        if kill -0 "$pid" 2>/dev/null; then
            log INFO "Stopping backend (PID $pid)..."
            kill -TERM "$pid" 2>/dev/null
            
            # Wait for graceful shutdown
            local waited=0
            while [ $waited -lt 10 ] && kill -0 "$pid" 2>/dev/null; do
                sleep 1
                ((waited++))
            done
            
            # Force kill if needed
            if kill -0 "$pid" 2>/dev/null; then
                kill -KILL "$pid" 2>/dev/null
            fi
            
            log OK "Backend stopped"
        fi
        rm -f "$LOG_DIR/backend.pid"
    else
        # Try to kill by port
        kill_port "$BACKEND_PORT" "backend"
    fi
    
    # Stop frontend
    if [ -f "$LOG_DIR/frontend.pid" ]; then
        local pid=$(cat "$LOG_DIR/frontend.pid")
        if kill -0 "$pid" 2>/dev/null; then
            log INFO "Stopping frontend (PID $pid)..."
            kill -TERM "$pid" 2>/dev/null
            
            # Wait for graceful shutdown
            local waited=0
            while [ $waited -lt 5 ] && kill -0 "$pid" 2>/dev/null; do
                sleep 1
                ((waited++))
            done
            
            # Force kill if needed
            if kill -0 "$pid" 2>/dev/null; then
                kill -KILL "$pid" 2>/dev/null
            fi
            
            log OK "Frontend stopped"
        fi
        rm -f "$LOG_DIR/frontend.pid"
    else
        # Try to kill by port
        kill_port "$FRONTEND_PORT" "frontend"
    fi
    
    log OK "All services stopped"
}

show_status() {
    echo ""
    log INFO "Service Status:"
    echo ""
    
    # Backend status
    printf "  %-15s " "Backend:"
    if is_port_in_use "$BACKEND_PORT"; then
        local health=$(curl -sf "http://localhost:$BACKEND_PORT/health" 2>/dev/null || echo '{"status":"error"}')
        if echo "$health" | grep -q '"status":"ok"'; then
            echo -e "${GREEN}● Running${NC} (port $BACKEND_PORT)"
        else
            echo -e "${YELLOW}● Unhealthy${NC} (port $BACKEND_PORT)"
        fi
    else
        echo -e "${RED}○ Stopped${NC}"
    fi
    
    # Frontend status
    printf "  %-15s " "Frontend:"
    if is_port_in_use "$FRONTEND_PORT"; then
        if curl -sf "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
            echo -e "${GREEN}● Running${NC} (port $FRONTEND_PORT)"
        else
            echo -e "${YELLOW}● Starting${NC} (port $FRONTEND_PORT)"
        fi
    else
        echo -e "${RED}○ Stopped${NC}"
    fi
    
    # PostgreSQL status
    printf "  %-15s " "PostgreSQL:"
    if systemctl is-active --quiet postgresql; then
        echo -e "${GREEN}● Running${NC} (port 5432)"
    else
        echo -e "${RED}○ Stopped${NC}"
    fi
    
    # Redis status
    printf "  %-15s " "Redis:"
    if systemctl is-active --quiet redis-server 2>/dev/null || systemctl is-active --quiet redis 2>/dev/null; then
        echo -e "${GREEN}● Running${NC} (port 6379)"
    else
        echo -e "${RED}○ Stopped${NC}"
    fi
    
    echo ""
    echo "  URLs:"
    echo "    Frontend:  http://localhost:$FRONTEND_PORT"
    echo "    Backend:   http://localhost:$BACKEND_PORT"
    echo "    Health:    http://localhost:$BACKEND_PORT/health"
    echo ""
}

# Graceful shutdown handler
cleanup() {
    echo ""
    log INFO "Received shutdown signal..."
    stop_services
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# ============================================
# MAIN
# ============================================
main() {
    banner
    
    case "${1:-start}" in
        start)
            check_dependencies || exit 1
            check_project_deps || exit 1
            start_backend || exit 1
            start_frontend || exit 1
            echo ""
            log OK "All services started successfully!"
            show_status
            ;;
        stop|--stop)
            stop_services
            ;;
        restart|--restart)
            stop_services
            sleep 2
            check_dependencies || exit 1
            start_backend || exit 1
            start_frontend || exit 1
            echo ""
            log OK "All services restarted successfully!"
            show_status
            ;;
        status|--status)
            show_status
            ;;
        logs)
            echo "Backend logs:"
            tail -50 "$LOG_DIR/backend.log" 2>/dev/null || echo "No logs found"
            echo ""
            echo "Frontend logs:"
            tail -50 "$LOG_DIR/frontend.log" 2>/dev/null || echo "No logs found"
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|status|logs}"
            echo ""
            echo "Commands:"
            echo "  start   - Start all services (default)"
            echo "  stop    - Stop all services"
            echo "  restart - Restart all services"
            echo "  status  - Show service status"
            echo "  logs    - Show recent logs"
            exit 1
            ;;
    esac
}

main "$@"
