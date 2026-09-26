@echo off
setlocal
title Crastur - Insumos de Cauchera y Repuestos de Moto
chcp 65001 >nul
cd /d "%~dp0"
color 06

echo ==============================================================
echo       CRASTUR - INSUMOS PARA CAUCHERAS Y REPUESTOS DE MOTO
echo ==============================================================
echo.

where node >nul 2>nul
if %errorlevel% equ 0 goto start_launcher

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
if %errorlevel% equ 0 goto start_launcher

:error_no_node
color 0C
echo.
echo ==============================================================
echo  [ERROR] No se encontro Node.js instalado en este equipo.
echo ==============================================================
echo.
echo  Para ejecutar Crastur, por favor instala Node.js (Version LTS):
echo     https://nodejs.org
echo.
echo  Despues de instalarlo, vuelve a hacer doble clic en Crastur.bat
echo.
pause
exit /b 1

:start_launcher
node launcher.js
if %errorlevel% neq 0 (
    echo.
    echo ==============================================================
    echo  Ocurrio un problema al ejecutar Crastur.
    echo ==============================================================
    echo.
    pause
)
