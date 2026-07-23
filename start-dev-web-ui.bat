@echo off

REM Avoid footgun by explicitly navigating to the directory containing the batch file
cd /d "%~dp0"

if not defined PYTHON (
    where python >NUL 2>NUL
    if errorlevel 1 (
        echo Error: Python is not installed or not in PATH
        goto :end_error
    )
    set PYTHON=python
)
if not defined VENV_DIR (set "VENV_DIR=%~dp0venv")

if exist "%VENV_DIR%\Scripts\python.exe" (
    set PYTHON="%VENV_DIR%\Scripts\python.exe" -X utf8
)

echo Starting OneTrainer Web UI in DEV mode with Live HMR...
bun install --cwd web --frozen-lockfile

start "OneTrainer Backend" %PYTHON% scripts\train_ui_web.py --dev %*
bun --cwd web run dev

goto :end

:end_error
pause
exit /b 1

:end
