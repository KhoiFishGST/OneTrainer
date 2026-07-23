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

if [[ " $* " != *" --dev "* ]]; then
    if ! run_python_in_active_env scripts/webui_build.py --check &>/dev/null; then
        print "Building Web UI frontend..."
        bun install --cwd web --frozen-lockfile
        bun run --cwd web build
        run_python_in_active_env scripts/webui_build.py --mark
    fi
fi

run_python_in_active_env scripts/train_ui_web.py "$@"
