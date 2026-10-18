@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js belum ditemukan. Install Node.js versi 22.16 atau lebih baru.
  pause
  exit /b 1
)
node scripts\setup-admin.mjs
if errorlevel 1 (
  echo Setup admin gagal atau dibatalkan.
  pause
  exit /b 1
)
echo Selesai. Restart bot, lalu gunakan .admin show via DM.
pause
