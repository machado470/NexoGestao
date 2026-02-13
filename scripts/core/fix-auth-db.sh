#!/bin/bash
set -euo pipefail

echo "[FIX] Rodando migrações Prisma dentro da API..."
docker compose exec -T api bash -lc '
set -e

SCHEMA1="prisma/schema.prisma"
SCHEMA2="apps/api/prisma/schema.prisma"

if [ -f "$SCHEMA1" ]; then
  npx prisma migrate deploy --schema "$SCHEMA1"
elif [ -f "$SCHEMA2" ]; then
  npx prisma migrate deploy --schema "$SCHEMA2"
else
  echo "[FIX] ❌ schema.prisma não encontrado (tentado: $SCHEMA1 e $SCHEMA2)"
  exit 1
fi

echo "[FIX] (Re)criando usuário admin@demo.com..."
node - << "NODE"
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

(async () => {
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash("demo", 10);

  const user = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {
      password: hash,
      name: "Admin Demo",
    },
    create: {
      email: "admin@demo.com",
      name: "Admin Demo",
      password: hash,
    },
  });

  console.log("Admin pronto:", user.email, user.id);
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
NODE
'

echo
echo "[FIX] Testando login..."
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo"}'
echo
