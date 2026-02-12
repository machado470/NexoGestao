// tmp-test.js
// Teste direto no host para verificar se Prisma está acessando o Postgres corretamente

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("🔍 Buscando questões no banco...");
    const questions = await prisma.question.findMany();

    console.log(`📌 Total de questões encontradas: ${questions.length}`);
    console.log("Primeiras 3 questões:");
    console.log(questions.slice(0, 3));
  } catch (err) {
    console.error("❌ ERRO AO BUSCAR QUESTÕES:");
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

