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
    echo -e "Por favor instala Node.js 22 LTS desde https://nodejs.org"
    echo -e "En Ubuntu/Debian: sudo apt install nodejs npm\n"
    exit 1
fi

if ! node -e "const v=process.versions.node.split('.').map(Number); process.exit((v[0]>22 || (v[0]===22 && v[1]>=12) || (v[0]===20 && v[1]>=19)) ? 0 : 1)"; then
    echo -e "${RED}${BOLD}[ERROR] Tu versión de Node.js ($(node -v)) es incompatible.${NC}"
    echo -e "Crastur necesita Node.js 20.19+ o 22.12+. Recomendado: 22 LTS."
    echo -e "Descárgalo en https://nodejs.org\n"
    exit 1
fi

node launcher.js
