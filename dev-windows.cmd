@echo off
setlocal
cd /d "%~dp0"
where cargo >nul 2>nul || (
  echo Rust/Cargo was not found.
  echo Install it with: winget install --id Rustlang.Rustup
  echo Then reopen the terminal and run: rustup default stable-msvc
  pause
  exit /b 1
)
call npm install
if errorlevel 1 exit /b 1
call npm run desktop:dev
