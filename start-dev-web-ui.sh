#!/usr/bin/env bash

set -e

source "${BASH_SOURCE[0]%/*}/lib.include.sh"

prepare_runtime_environment

if ! run_python_in_active_env -c "import fastapi, uvicorn" &>/dev/null; then
    print_error "Web UI dependencies are missing. Please run:\npython -m pip install -r requirements-webui.txt\nbun --cwd web install --frozen-lockfile"
    exit 1
fi

if ! can_exec bun; then
    print_error "Bun executable not found in PATH. Please install Bun and run:\npython -m pip install -r requirements-webui.txt\nbun --cwd web install --frozen-lockfile"
    exit 1
fi

print "Starting OneTrainer Web UI in DEV mode with Live HMR..."

# Ensure bun dependencies are installed
bun install --cwd web --frozen-lockfile

# Cleanup function on exit
cleanup() {
    print "Stopping dev servers..."
    kill $(jobs -p) 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Start backend server in background with --dev flag
run_python_in_active_env scripts/train_ui_web.py --dev "$@" &
BACKEND_PID=$!

print "Backend running on http://127.0.0.1:7801 (PID $BACKEND_PID)"
print "Starting Vite Dev Server with Live HMR on http://localhost:5173 ..."

# Start Vite dev server in foreground
bun --cwd web run dev
