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

IS_DEV=false
for arg in "$@"; do
    if [[ "$arg" == "dev" || "$arg" == "--dev" ]]; then
        IS_DEV=true
        break
    fi
done

if [ "$IS_DEV" = true ]; then
    print "Starting OneTrainer Web UI in DEV mode with Live HMR..."

    (cd web && bun install --frozen-lockfile)

    cleanup() {
        print "Stopping dev servers..."
        kill $(jobs -p) 2>/dev/null || true
    }
    trap cleanup EXIT INT TERM

    run_python_in_active_env scripts/train_ui_web.py --dev "$@" &
    BACKEND_PID=$!

    print "Backend running on http://127.0.0.1:7801 (PID $BACKEND_PID)"
    print "Starting Vite Dev Server with Live HMR on http://0.0.0.0:5173 ..."

    (cd web && bun run dev -- --host 0.0.0.0)
else
    if ! run_python_in_active_env scripts/webui_build.py --check &>/dev/null; then
        print "Building Web UI frontend..."
        (cd web && bun install --frozen-lockfile && bun run build)
        run_python_in_active_env scripts/webui_build.py --mark
    fi

    run_python_in_active_env scripts/train_ui_web.py "$@"
fi
