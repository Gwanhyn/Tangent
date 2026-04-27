@echo off
setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "APP_URL=http://localhost:5173"

title Tangent Launcher
echo.
echo ========================================
echo  Tangent - Windows Quick Start
echo ========================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python was not found. Please install Python 3.12+ and try again.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Please install Node.js 20+ and try again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Please install Node.js with npm and try again.
  pause
  exit /b 1
)

echo [1/4] Checking backend dependencies...
python -c "import fastapi, uvicorn, litellm, requests" >nul 2>nul
if errorlevel 1 (
  echo Installing backend dependencies...
  python -m pip install -r "%BACKEND%\requirements.txt"
  if errorlevel 1 (
    echo [ERROR] Backend dependency installation failed.
    pause
    exit /b 1
  )
) else (
  echo Backend dependencies are ready.
)

echo.
echo [2/4] Checking frontend dependencies...
if not exist "%FRONTEND%\node_modules" (
  echo Installing frontend dependencies...
  pushd "%FRONTEND%"
  call npm install
  set "NPM_INSTALL_EXIT=!errorlevel!"
  popd
  if not "!NPM_INSTALL_EXIT!"=="0" (
    echo [ERROR] Frontend dependency installation failed.
    pause
    exit /b 1
  )
) else (
  echo Frontend dependencies are ready.
)

echo.
echo [3/4] Starting backend at http://127.0.0.1:8000 ...
start "Tangent Backend" /D "%ROOT%" cmd /k "python -m uvicorn app.main:app --app-dir backend --reload --port 8000"

echo [4/4] Starting frontend at %APP_URL% ...
start "Tangent Frontend" /D "%FRONTEND%" cmd /k "npm run dev"

echo.
echo Waiting a moment before opening the browser...
timeout /t 3 /nobreak >nul
start "" "%APP_URL%"

echo.
echo Tangent is starting.
echo Backend window:  http://127.0.0.1:8000
echo Frontend window: %APP_URL%
echo.
echo Keep the two opened terminal windows running while using Tangent.
pause
