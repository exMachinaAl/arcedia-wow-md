@echo off
setlocal
cd /d "%~dp0"
echo WA-WORLD -- Buat ZIP source untuk update tanpa GitHub.
node "%~dp0scripts\export-project.mjs"
set "CODE=%ERRORLEVEL%"
if "%CODE%"=="0" explorer "%~dp0exports"
pause
exit /b %CODE%
