#!/usr/bin/env bash
# ==============================================================
#       CRASTUR - INSUMOS PARA CAUCHERAS Y REPUESTOS DE MOTO
#              Iniciador Directo para Linux / macOS
# ==============================================================

cd "$(dirname "$0")"

# Colores de consola
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}==============================================================${NC}"
echo -e "${CYAN}${BOLD}      CRASTUR - INSUMOS DE CAUCHERA Y REPUESTOS DE MOTO       ${NC}"
echo -e "${CYAN}==============================================================${NC}\n"

if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}${BOLD}[ERROR] No se encontró Node.js instalado en este equipo.${NC}"
    echo -e "Por favor instala Node.js (versión 18, 20 o 22 LTS) desde https://nodejs.org"
    echo -e "En Ubuntu/Debian: sudo apt install nodejs npm\n"
    exit 1
fi

node launcher.js
