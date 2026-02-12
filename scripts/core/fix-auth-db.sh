#!/bin/bash
set -e

echo "[FIX] Rodando migrações Prisma dentro da API..."
docker compose exec -T api bash -lc '
set -e
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

echo "[FIX] (Re)criando usuário admin@autoescola.com..."
node - << "NODE"
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

(async () => {
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash("123456", 10);

  const user = await prisma.user.upsert({
    where: { email: "admin@autoescola.com" },
    update: {
      password: hash,
      name: "Admin Autoescola",
    },
    create: {
      email: "admin@autoescola.com",
      name: "Admin Autoescola",
      password: hash,
      // createdAt / updatedAt entram sozinhos se tiver default no schema
    },
  });

  console.log("Admin pronto:", user.email, user.id);
  await prisma.$disconnect();
})();
NODE
'

echo
echo "[FIX] Testando login..."
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@autoescola.com","password":"123456"}'
echo
