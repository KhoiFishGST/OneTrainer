@echo off

REM Avoid footgun by explictly navigating to the directory containing the batch file
cd /d "%~dp0"

REM Verify that OneTrainer is our current working directory
if not exist "scripts\train_ui_web.py" (
    echo Error: train_ui_web.py does not exist, you have done something very wrong. Reclone the repository.
    goto :end_error
)

if not defined PYTHON (
    where python >NUL 2>NUL
    if errorlevel 1 (
        echo Error: Python is not installed or not in PATH
        goto :end_error
    )
    set PYTHON=python
)
if not defined VENV_DIR (set "VENV_DIR=%~dp0venv")

:check_venv
dir "%VENV_DIR%" > NUL 2> NUL
if not errorlevel 1 goto :activate_venv
echo venv not found, please run install.bat first
goto :end_error

:activate_venv
echo activating venv %VENV_DIR%
if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo Error: Python executable not found in virtual environment
    goto :end_error
)
set PYTHON="%VENV_DIR%\Scripts\python.exe" -X utf8
if defined PROFILE (set PYTHON=%PYTHON% -m scalene --off --cpu --gpu --profile-all --no-browser)
echo Using Python %PYTHON%

:check_python_version
echo Checking Python version...
%PYTHON% --version
if errorlevel 1 (
    echo Error: Failed to get Python version
    goto :end_error
)

echo.
%PYTHON% "%~dp0scripts\util\version_check.py" 3.10 3.14 2>&1
if errorlevel 1 (
    echo.
    goto :wrong_python_version
)

:check_webui_dependencies
%PYTHON% -c "import fastapi, uvicorn" >NUL 2>NUL
if errorlevel 1 (
    echo Error: Web UI dependencies are missing. Please run:
    echo python -m pip install -r requirements-webui.txt
    echo bun --cwd web install --frozen-lockfile
    goto :end_error
)

where bun >NUL 2>NUL
if errorlevel 1 (
    echo Error: Bun is not installed or not in PATH. Please install Bun and run:
    echo python -m pip install -r requirements-webui.txt
    echo bun --cwd web install --frozen-lockfile
    goto :end_error
)

:check_dev
set IS_DEV=0
for %%a in (%*) do (
    if "%%a"=="dev" set IS_DEV=1
    if "%%a"=="--dev" set IS_DEV=1
)

if "%IS_DEV%"=="1" (
    echo Starting OneTrainer Web UI in DEV mode with Live HMR...
    cd web && bun install --frozen-lockfile && cd ..
    start "OneTrainer Backend" %PYTHON% scripts\train_ui_web.py --dev %*
    cd web && bun run dev -- --host 0.0.0.0
    goto :end
)

:check_build
%PYTHON% scripts\webui_build.py --check >NUL 2>NUL
if errorlevel 1 (
    echo Building Web UI frontend...
    bun install --cwd web --frozen-lockfile
    if errorlevel 1 goto :end_error
    bun run --cwd web build
    if errorlevel 1 goto :end_error
    %PYTHON% scripts\webui_build.py --mark
    if errorlevel 1 goto :end_error
)

:launch
echo Starting Web UI...
%PYTHON% scripts\train_ui_web.py %*
set EXIT_CODE=%ERRORLEVEL%
if %EXIT_CODE% neq 0 (
    echo Error: Web UI script exited with code %EXIT_CODE%
    pause
    exit /b %EXIT_CODE%
)
goto :end

:wrong_python_version
echo Error: Unsupported Python version.
goto :end_error

:end_error
pause
exit /b 1

:end
pause
