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
if %errorlevel% equ 0 goto check_node_version

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
if %errorlevel% equ 0 goto check_node_version

:check_node_version
rem Crastur requiere Node.js 20.19+ (o 22.12+) por Baileys 7 y Vite 8.
for /f "tokens=1,2 delims=." %%v in ('node -p "process.versions.node"') do (
    set "NODE_MAJOR=%%v"
    set "NODE_MINOR=%%w"
)
if %NODE_MAJOR% lss 20 goto error_old_node
if %NODE_MAJOR% equ 20 if %NODE_MINOR% lss 19 goto error_old_node
if %NODE_MAJOR% equ 21 goto error_old_node
if %NODE_MAJOR% equ 22 if %NODE_MINOR% lss 12 goto error_old_node
goto check_install

:error_old_node
color 0C
echo.
echo ==============================================================
echo  [ERROR] Tu version de Node.js es incompatible.
echo ==============================================================
echo.
echo  Crastur necesita Node.js 20.19+ o 22.12+.
echo  Recomendado: Node.js 22 LTS.
echo.
echo  (La libreria de WhatsApp requiere Node 20+ y el panel visual
echo   requiere Node 20.19+ o 22.12+).
echo.
echo  Descarga la version LTS mas reciente en: https://nodejs.org
echo.
echo  Despues de instalarla, vuelve a hacer doble clic en Crastur.bat
echo.
pause
exit /b 1

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

:check_install
rem Si faltan dependencias o el panel compilado, abrir el INSTALADOR VISUAL
if not exist "node_modules\express" goto needs_install
if not exist "node_modules\tsx" goto needs_install
if not exist "node_modules\sql.js" goto needs_install
if not exist "node_modules\@whiskeysockets\baileys" goto needs_install
if not exist "client\dist\index.html" goto needs_install
goto start_launcher

:needs_install
color 0E
echo.
echo  ------------------------------------------------------------------
echo   El sistema aun no esta instalado o le faltan componentes.
echo   Se abrira el INSTALADOR VISUAL para dejarlo listo con un clic.
echo  ------------------------------------------------------------------
echo.
node installer\server.js
exit /b 0

:start_launcher
node launcher.js
if %errorlevel% neq 0 (
    echo.
    echo ==============================================================
    echo  Ocurrio un problema al ejecutar Crastur.
    echo ==============================================================
    echo.
    echo  Puedes abrir el INSTALADOR VISUAL para reparar el sistema:
    echo     doble clic en Instalar.bat
    echo.
    pause
)
