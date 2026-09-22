# ==============================================================
#       CRASTUR - INSUMOS PARA CAUCHERAS Y REPUESTOS DE MOTO
# ==============================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location -Path $PSScriptRoot
$host.UI.RawUI.WindowTitle = "Crastur - Insumos de Cauchera y Repuestos de Moto"

Write-Host "==============================================================" -ForegroundColor Yellow
Write-Host "      CRASTUR - INSUMOS PARA CAUCHERAS Y REPUESTOS DE MOTO" -ForegroundColor Yellow
Write-Host "==============================================================" -ForegroundColor Yellow
Write-Host ""

# 1. Comprobar Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\Program Files\nodejs\node.exe") {
        $env:Path += ";C:\Program Files\nodejs"
    } elseif (Test-Path "C:\Program Files (x86)\nodejs\node.exe") {
        $env:Path += ";C:\Program Files (x86)\nodejs"
    }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] No se encontro Node.js instalado en esta computadora." -ForegroundColor Red
    Write-Host ""
    Write-Host "Para ejecutar Crastur, por favor instala Node.js (Version LTS):"
    Write-Host "   https://nodejs.org" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Presiona Enter para salir..."
    exit 1
}

# 2. Iniciar mediante el lanzador inteligente de Crastur
node launcher.js
