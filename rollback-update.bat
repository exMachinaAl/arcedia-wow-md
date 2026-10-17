@echo off
setlocal
cd /d "%~dp0"
echo Tutup dashboard, simulator dan bot SEBELUM rollback.
set /p "OK=Lanjut rollback update terakhir? ketik YES: "
if /I not "%OK%"=="YES" (echo Dibatalkan.& pause & exit /b 1)
node "%~dp0scripts\merge-updater.mjs" rollback --project "%~dp0"
set "RESULT=%ERRORLEVEL%"
pause
exit /b %RESULT%
