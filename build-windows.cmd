@echo off
setlocal
cd /d "%~dp0"

echo.
echo CleanMyFiles - Windows release build
echo ====================================

where node >nul 2>nul || (
  echo [ERROR] Node.js is not installed or is not in PATH.
  echo Install Node.js LTS, reopen this terminal, then run this file again.
  pause
  exit /b 1
)

where cargo >nul 2>nul || (
  echo [ERROR] Rust/Cargo is not installed or is not in PATH.
  echo Run: winget install --id Rustlang.Rustup
  echo Then reopen the terminal and run: rustup default stable-msvc
  pause
  exit /b 1
)

echo [1/3] Installing frontend dependencies...
call npm install
if errorlevel 1 goto :fail

echo [2/3] Checking frontend...
call npm run build
if errorlevel 1 goto :fail

echo [3/3] Building Windows installers...
call npm run desktop:build
if errorlevel 1 goto :fail

echo.
echo Build complete.
echo Opening bundle folder...
start "" "%~dp0src-tauri\target\release\bundle"
exit /b 0

:fail
echo.
echo [ERROR] Build failed. Read the error above.
pause
exit /b 1
