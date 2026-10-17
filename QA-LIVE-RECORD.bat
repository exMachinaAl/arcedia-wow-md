@echo off
cd /d "%~dp0"
node scripts/qa-live.mjs
if errorlevel 1 (pause & exit /b 1)
node --experimental-sqlite scripts/qa-runner.mjs
pause
