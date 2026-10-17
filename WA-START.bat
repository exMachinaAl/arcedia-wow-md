@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (echo Node.js 22.16+ belum terpasang.& pause & exit /b 1)
if not exist "node_modules\@whiskeysockets\baileys" (
 echo Menginstal dependency Baileys, Pino, QR renderer...
 call npm install --no-audit --no-fund
 if errorlevel 1 (echo Install gagal. Periksa koneksi internet, Node.js, dan npm.& pause & exit /b 1)
)
echo.
echo Hubungkan dari WA: Perangkat Tertaut ^> Tautkan Perangkat.
echo Jalankan tes pada chat pribadi, bukan grup.
echo.
npm run bot
pause
