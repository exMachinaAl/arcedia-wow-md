@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (echo Node.js 22.16+ belum tersedia di PATH.& pause & exit /b 1)
set "PATCH="
for %%F in ("%~dp0updates\incoming\*.zip") do if exist "%%~fF" set "PATCH=%%~fF"
echo WA-WORLD Offline ZIP Updater
if defined PATCH echo Ditemukan: %PATCH%
set /p "CUSTOM=Lokasi ZIP patch [ENTER = gunakan yang ditemukan]: "
if not "%CUSTOM%"=="" set "PATCH=%CUSTOM:"=%"
if not defined PATCH (echo Tidak menemukan patch ZIP. Simpan di updates\incoming\ & pause & exit /b 1)
node "%~dp0scripts\merge-updater.mjs" apply "%PATCH%" --project "%~dp0"
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" echo ERROR. Tidak dilakukan override paksa.
pause
exit /b %RESULT%
