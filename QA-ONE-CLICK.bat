@echo off
cd /d "%~dp0"
echo === WA-WORLD QA Automation ===
node --experimental-sqlite scripts/qa-runner.mjs
set "RESULT=%ERRORLEVEL%"
echo.
echo Dashboard: http://127.0.0.1:3000
pause
exit /b %RESULT%
