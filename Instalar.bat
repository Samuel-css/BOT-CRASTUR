@echo off
setlocal
title Crastur - Instalacion y Mantenimiento
chcp 65001 >nul
cd /d "%~dp0"

echo ==============================================================
echo    CRASTUR - INSTALADOR VISUAL Y MANTENIMIENTO
echo ==============================================================
echo.

where node >nul 2>nul
if %errorlevel% equ 0 goto start_installer

if exist "C:\Program Files\nodejs\node.exe" goto add_path_64
if exist "C:\Program Files (x86)\nodejs\node.exe" goto add_path_32
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" goto add_path_local
goto error_no_node

:add_path_64
set "PATH=%PATH%;C:\Program Files\nodejs"
goto check_again

:add_path_32
set "PATH=%PATH%;C:\Program Files (x86)\nodejs"
goto check_again

:add_path_local
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\nodejs"
goto check_again

:check_again
where node >nul 2>nul
if %errorlevel% equ 0 goto start_installer

:error_no_node
color 0C
echo.
echo ==============================================================
echo  [ERROR] No se encontro Node.js instalado en este equipo.
echo ==============================================================
echo.
echo  Para ejecutar Crastur, primero instala Node.js (Version LTS):
echo     https://nodejs.org
echo.
echo  Despues de instalarlo, vuelve a hacer doble clic en Instalar.bat
echo.
pause
exit /b 1

:start_installer
node installer\server.js
if %errorlevel% neq 0 (
    echo.
    echo ==============================================================
    echo  Ocurrio un problema al abrir el instalador.
    echo ==============================================================
    echo.
    pause
)
