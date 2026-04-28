@echo off
setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "BACKEND_HEALTH=http://127.0.0.1:8000/api/health"
set "APP_URL=http://127.0.0.1:5173"

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

echo [1/5] Checking backend dependencies...
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
echo [2/5] Checking frontend dependencies...
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
echo [3/5] Starting backend at http://127.0.0.1:8000 ...
call :WaitForUrl "%BACKEND_HEALTH%" 1 "backend" >nul 2>nul
if errorlevel 1 (
  start "Tangent Backend" /D "%ROOT%" cmd /k "python -m uvicorn app.main:app --app-dir backend --reload --port 8000"
) else (
  echo Backend is already running.
)

call :WaitForUrl "%BACKEND_HEALTH%" 75 "backend"
if errorlevel 1 (
  echo.
  echo [ERROR] Backend did not report ready in time.
  echo Please check the Tangent Backend window for details.
  pause
  exit /b 1
)

echo.
echo [4/5] Starting frontend at %APP_URL% ...
call :WaitForUrl "%APP_URL%" 1 "frontend" >nul 2>nul
if errorlevel 1 (
  start "Tangent Frontend" /D "%FRONTEND%" cmd /k "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"
) else (
  echo Frontend is already running.
)

echo.
echo [5/5] Waiting for frontend readiness signal...
call :WaitForUrl "%APP_URL%" 75 "frontend"
if errorlevel 1 (
  echo.
  echo [ERROR] Frontend did not report ready in time.
  echo Please check the Tangent Frontend window for details.
  pause
  exit /b 1
)

echo.
echo Opening Tangent in your browser...
start "" "%APP_URL%"

echo.
echo Tangent is starting.
echo Backend window:  http://127.0.0.1:8000
echo Frontend window: %APP_URL%
echo.
echo Keep the two opened terminal windows running while using Tangent.
pause

exit /b 0

:WaitForUrl
set "WAIT_URL=%~1"
set "WAIT_SECONDS=%~2"
set "WAIT_NAME=%~3"
echo Waiting for %WAIT_NAME% readiness signal...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$url=$env:WAIT_URL; $deadline=(Get-Date).AddSeconds([int]$env:WAIT_SECONDS); while((Get-Date) -lt $deadline){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){ Write-Host ' ready'; exit 0 } } catch {}; Write-Host -NoNewline '.'; Start-Sleep -Milliseconds 800 }; exit 1"
exit /b %errorlevel%
