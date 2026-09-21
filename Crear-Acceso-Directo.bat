@echo off
title Crear Acceso Directo de Crastur
chcp 65001 >nul
cd /d "%~dp0"
color 0A

echo ==============================================================
echo       CREADOR DE ACCESO DIRECTO PARA EL ESCRITORIO
echo ==============================================================
echo.
echo Asignando icono oficial y configurando acceso directo...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
  "$shortcut = $ws.CreateShortcut(\"$desktop\Crastur.lnk\"); " ^
  "$shortcut.TargetPath = '%~dp0Crastur.bat'; " ^
  "$shortcut.WorkingDirectory = '%~dp0'; " ^
  "$shortcut.IconLocation = '%~dp0crastur.ico,0'; " ^
  "$shortcut.Description = 'Crastur - Insumos para Caucheras y Repuestos de Moto'; " ^
  "$shortcut.WindowStyle = 7; " ^
  "$shortcut.Save()"

echo.
echo ==============================================================
echo  [EXITO] Se ha creado el acceso directo 'Crastur' en tu Escritorio
echo  con el icono oficial de la motocicleta y apertura optimizada.
echo ==============================================================
echo.
timeout /t 3 >nul
