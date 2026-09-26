#!/usr/bin/env bash
# ==============================================================
#       CRASTUR - INSUMOS PARA CAUCHERAS Y REPUESTOS DE MOTO
#           Script Técnico de Apagado para Linux / macOS
# ==============================================================

cd "$(dirname "$0")/.."

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}==============================================================${NC}"
echo -e "${CYAN}${BOLD}      CRASTUR - APAGADO SEGURO DEL SISTEMA Y BOT              ${NC}"
echo -e "${CYAN}==============================================================${NC}\n"

echo -e "Guardando base de datos y deteniendo servicios..."

# 1. Petición HTTP al endpoint de apagado elegante
curl -s -X POST http://localhost:3333/api/system/shutdown >/dev/null 2>&1 || true

sleep 1

# 2. Asegurar que el puerto 3333 quede libre
if command -v fuser >/dev/null 2>&1; then
    fuser -k 3333/tcp >/dev/null 2>&1 || true
fi

echo -e "\n${GREEN}${BOLD}✓ Crastur ha sido apagado correctamente.${NC}"
echo -e "El bot de WhatsApp y el servidor se han detenido.\n"
