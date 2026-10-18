@echo off
setlocal EnableExtensions DisableDelayedExpansion
pushd "%~dp0" || (echo Tidak dapat masuk ke folder proyek. & pause & exit /b 1)
where node >nul 2>&1 || (echo Node.js 22.16+ tidak ditemukan. & pause & exit /b 1)
echo =========================================
echo  WA-WORLD - Developer API Key Manager
 echo =========================================
echo.
echo 1 - Buat API key READ CATALOG saja
 echo 2 - Daftar key (tanpa menampilkan secret)
 echo 3 - Cabut key
 echo.
set "CHOICE="
set /p "CHOICE=Pilih 1, 2, atau 3: "
if "%CHOICE%"=="1" (
  set "LABEL="
  set /p "LABEL=Nama aplikasi (3-35 karakter): "
  if not defined LABEL (echo Nama wajib diisi.&pause&exit /b 1)
  node scripts/dev-keys.mjs create "%LABEL%" read:catalog
) else if "%CHOICE%"=="2" (
  node scripts/dev-keys.mjs list
) else if "%CHOICE%"=="3" (
  set "KEY_ID="
  set /p "KEY_ID=Masukkan ID key: "
  node scripts/dev-keys.mjs revoke "%KEY_ID%"
) else (
  echo Pilihan tidak valid.
)
echo.
echo CATATAN: token rahasia hanya tampil saat dibuat. Jangan bagikan.
pause
