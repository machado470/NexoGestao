#!/usr/bin/env bash
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${YELLOW}▶ Verificando Docker daemon...${NC}"
if docker version >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Docker acessível no WSL (Client + Server ok).${NC}"
  # checa compose
  if docker compose version >/dev/null 2>&1; then
    echo -e "${GREEN}✓ docker compose disponível.${NC}"
    exit 0
  else
    echo -e "${RED}✗ 'docker compose' não encontrado.${NC}"
    echo -e "   Tente instalar o plugin no WSL: ${YELLOW}sudo apt update && sudo apt install -y docker-compose-plugin${NC}"
    exit 2
  fi
else
  echo -e "${RED}✗ Não foi possível conectar ao Docker daemon no WSL.${NC}"
  echo -e "   Possíveis correções:"
  echo -e "   1) Abra ${YELLOW}Docker Desktop${NC} no Windows."
  echo -e "   2) Em ${YELLOW}Docker Desktop → Settings → Resources → WSL Integration${NC}:"
  echo -e "      - Marque ${YELLOW}Enable integration with my default WSL distro${NC}"
  echo -e "      - Ative a sua distro (ex.: ${YELLOW}Ubuntu-22.04${NC}) e clique ${YELLOW}Apply & Restart${NC}"
  echo -e "   3) Teste novamente: ${YELLOW}docker version${NC}"
  echo -e "   4) (Opcional) No WSL, tente: ${YELLOW}sudo apt install -y docker-compose-plugin${NC}"
  exit 1
fi
