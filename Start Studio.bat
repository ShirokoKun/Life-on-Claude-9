@echo off
rem Windows: double-click to set up (first time) and open Claude Nine Studio in your browser.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is needed. Trying winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo Install Node.js LTS from https://nodejs.org then double-click this file again.
    start https://nodejs.org/en/download
    pause
    exit /b 1
  )
  echo Node.js installed. Close this window and double-click Start Studio.bat again.
  pause
  exit /b 0
)
node studio\setup.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
node studio\server.mjs --open
pause
