#!/bin/bash

# Flux Studio - Startup Script
# ============================

echo "╔════════════════════════════════════════╗"
echo "║         🎨 Flux Studio                 ║"
echo "║   AI-Powered Image Generation          ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
COMFYUI_DIR="/Users/btankut/Documents/ComfyUI"

# Check if ComfyUI is running
check_comfyui() {
    if curl -s http://127.0.0.1:8188/system_stats > /dev/null 2>&1; then
        echo -e "${GREEN}✓ ComfyUI is running${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ ComfyUI is not running${NC}"
        return 1
    fi
}

# Start ComfyUI
start_comfyui() {
    echo -e "${BLUE}Starting ComfyUI...${NC}"
    cd "$COMFYUI_DIR"

    if [ -d ".venv" ]; then
        source .venv/bin/activate
    fi

    python main.py --listen 127.0.0.1 --port 8188 &
    COMFYUI_PID=$!
    echo "ComfyUI PID: $COMFYUI_PID"

    # Wait for ComfyUI to start
    echo "Waiting for ComfyUI to initialize..."
    for i in {1..60}; do
        if curl -s http://127.0.0.1:8188/system_stats > /dev/null 2>&1; then
            echo -e "${GREEN}✓ ComfyUI started successfully${NC}"
            return 0
        fi
        sleep 2
    done

    echo -e "${RED}✗ ComfyUI failed to start${NC}"
    return 1
}

# Setup Python virtual environment for backend
setup_backend() {
    cd "$BACKEND_DIR"

    if [ ! -d ".venv" ]; then
        echo -e "${BLUE}Creating Python virtual environment...${NC}"
        python3 -m venv .venv
    fi

    source .venv/bin/activate

    echo -e "${BLUE}Installing backend dependencies...${NC}"
    pip install -q -r requirements.txt
}

# Start backend
start_backend() {
    cd "$BACKEND_DIR"
    source .venv/bin/activate

    echo -e "${BLUE}Starting backend API...${NC}"

    # Set OpenRouter API key from environment or .env file
    if [ -f "$SCRIPT_DIR/.env" ]; then
        export $(cat "$SCRIPT_DIR/.env" | xargs)
    fi

    python -m uvicorn main:app --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"

    sleep 2
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend started successfully${NC}"
    else
        echo -e "${RED}✗ Backend failed to start${NC}"
    fi
}

# Start frontend (simple HTTP server)
start_frontend() {
    cd "$FRONTEND_DIR"

    echo -e "${BLUE}Starting frontend server...${NC}"
    python3 -m http.server 3000 &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"

    sleep 1
    echo -e "${GREEN}✓ Frontend started${NC}"
}

# Main
main() {
    echo ""
    echo -e "${BLUE}Step 1: Checking ComfyUI...${NC}"
    if ! check_comfyui; then
        read -p "Do you want to start ComfyUI? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            start_comfyui
        else
            echo -e "${YELLOW}Warning: Image generation won't work without ComfyUI${NC}"
        fi
    fi

    echo ""
    echo -e "${BLUE}Step 2: Setting up backend...${NC}"
    setup_backend

    echo ""
    echo -e "${BLUE}Step 3: Starting services...${NC}"
    start_backend
    start_frontend

    echo ""
    echo "════════════════════════════════════════"
    echo -e "${GREEN}Flux Studio is ready!${NC}"
    echo ""
    echo -e "  🌐 Frontend: ${BLUE}http://localhost:3000${NC}"
    echo -e "  📡 Backend:  ${BLUE}http://localhost:8000${NC}"
    echo -e "  🎨 ComfyUI:  ${BLUE}http://localhost:8188${NC}"
    echo ""
    echo "Press Ctrl+C to stop all services"
    echo "════════════════════════════════════════"

    # Wait and cleanup on exit
    trap cleanup EXIT
    wait
}

cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"

    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi

    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi

    # Don't kill ComfyUI by default
    echo -e "${GREEN}Services stopped${NC}"
}

main
