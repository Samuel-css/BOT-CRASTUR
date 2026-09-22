#!/usr/bin/env bash
# ==============================================================
#           CRASTUR - INSUMOS CAUCHERA Y REPUESTOS MOTO
# ==============================================================
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
    echo "[AVISO] Node.js no se encuentra instalado en este sistema."
    echo "Por favor instala Node.js (versión LTS recomendada): https://nodejs.org"
    exit 1
fi

node launcher.js
