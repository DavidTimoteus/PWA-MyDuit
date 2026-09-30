@echo off
title MyDuit PWA Mobile Server
cd /d "%~dp0"
echo [1/2] Memulai server lokal MyDuit PWA di port 4173...
start /b "" node serve-dist.mjs
timeout /t 2 /nobreak >nul
echo [2/2] Membuka Cloudflare Tunnel HTTPS untuk HP/Mobile...
"%APPDATA%\9router\bin\cloudflared.exe" tunnel --url http://127.0.0.1:4173
pause
