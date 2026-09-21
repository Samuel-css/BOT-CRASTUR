@echo off
title Crastur - Insumos de Cauchera y Repuestos de Moto
chcp 65001 >nul
cd /d "%~dp0"
color 06

echo ==============================================================
echo       CRASTUR - INSUMOS PARA CAUCHERAS Y REPUESTOS DE MOTO
echo ==============================================================
echo.

:: 1. Comprobar instalación de Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] No se encontro Node.js instalado en esta computadora.
    echo.
    echo Para ejecutar Crastur, por favor instala Node.js (Version LTS):
    echo    https://nodejs.org
    echo.
    echo Despues de instalarlo, vuelve a hacer doble clic en Crastur.bat
    echo ==============================================================
    pause
    exit /b
)

:: 2. Auto-verificación de dependencias (si es primera vez que arranca)
if not exist "node_modules\express" (
    echo [1/3] Instalando componentes del servidor (primera vez)...
    call npm install --no-audit --no-fund
)

if not exist "client\dist\index.html" (
    echo [2/3] Compilando panel administrativo visual...
    call npm --prefix client install --no-audit --no-fund
    call npm --prefix client run build
)

:: 3. Verificar si el servidor ya está activo en el puerto 3333
netstat -ano | findstr ":3333 " | findstr "LISTENING" >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] El servidor ya se encuentra en ejecucion en segundo plano.
    goto open_app
)

:: 4. Iniciar servidor Crastur
echo [3/3] Iniciando servidor y conexion WhatsApp...
start /B node server/server.js

:wait_server
timeout /t 2 /nobreak >nul

:open_app
echo [LISTO] Abriendo Crastur en tu pantalla...

:: 5. Intentar abrir en Modo App Nativa con Edge (sin barras de navegador)
where msedge >nul 2>nul
if %errorlevel% equ 0 (
    start msedge --app=http://localhost:3333 --window-size=1366,860
) else (
    :: Fallback: Abrir en el navegador predeterminado (Chrome, Firefox, etc.)
    start http://localhost:3333
)

echo.
echo ==============================================================
echo  El sistema esta activo. Puedes minimizar esta ventana.
echo  Para cerrar el sistema por completo, cierra esta ventana.
echo ==============================================================
echo.

:: Mantener la consola viva para poder monitorear o cerrar cuando el usuario quiera
cmd /k
