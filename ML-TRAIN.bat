@echo off
setlocal
pushd "%~dp0"
node --experimental-sqlite scripts\train-matchmaking.mjs
if errorlevel 1 echo Pelatihan gagal; periksa error.
echo Hasil ML bersifat opsional; bot akan tetap pakai Elo bila belum memenuhi syarat.
pause
