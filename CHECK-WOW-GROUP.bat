@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo [ERROR] Node.js tidak ditemukan. Butuh Node 22.16.0 atau lebih baru.
 pause
 exit /b 1
)
node --experimental-sqlite scripts\check-wow-group.mjs
set code=%ERRORLEVEL%
echo.
pause
exit /b %code%
