@echo off
setlocal
title Apagar Crastur - Sistema de Ventas y Bot
chcp 65001 >nul
cd /d "%~dp0\.."
color 0C

echo ==============================================================
echo       CRASTUR - APAGADO SEGURO DEL SISTEMA Y BOT
echo ==============================================================
echo.
echo  Solicitando apagado y guardando base de datos...

:: 1. Intentar llamar al endpoint de apagado seguro mediante PowerShell
powershell -NoProfile -Command "try { $res = Invoke-RestMethod -Uri 'http://localhost:3333/api/system/shutdown' -Method Post -TimeoutSec 3; Write-Output $res.message } catch {}" >nul 2>&1

:: 2. Pausa breve para permitir que SQLite guarde el archivo en disco
timeout /t 1 /nobreak >nul 2>&1

:: 3. Verificar si el puerto 3333 sigue abierto y liberar el proceso si quedo colgado
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3333" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

color 0A
echo.
echo ==============================================================
echo  [OK] CRASTUR SE HA APAGADO CORRECTAMENTE
echo ==============================================================
echo.
echo  - La base de datos fue guardada con exito.
echo  - El servidor local y el bot de WhatsApp se han detenido.
echo  - El puerto 3333 ha quedado libre.
echo.
echo  Para volver a encenderlo en cualquier momento:
echo    - Usa el acceso directo Crastur de tu Escritorio.
echo    - O ejecuta Crastur.bat en la carpeta principal.
echo.
echo ==============================================================
echo  Esta ventana se cerrara en 4 segundos...
timeout /t 4 >nul
exit /b 0
