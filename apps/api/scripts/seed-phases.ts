import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding phases...');

  const categories = await prisma.category.findMany();
  if (categories.length === 0) {
    throw new Error('Nenhuma categoria encontrada! Rode o seed de categorias antes.');
  }

  const phasesData = [
    { name: 'Fase 1', description: 'Introdução e conceitos básicos' },
    { name: 'Fase 2', description: 'Direção defensiva' },
    { name: 'Fase 3', description: 'Primeiros socorros' },
    { name: 'Fase 4', description: 'Meio ambiente e cidadania' },
    { name: 'Fase 5', description: 'Funcionamento do veículo' },
    { name: 'Fase 6', description: 'Legislação de trânsito' },
    { name: 'Fase 7', description: 'Infrações e penalidades' },
  ];

  for (const category of categories) {
    console.log(`→ Criando phases para categoria: ${category.name}`);

    for (const phase of phasesData) {
      await prisma.phase.create({
        data: {
          name: phase.name,
          description: phase.description,
          categoryId: category.id,
        },
      });
    }
  }

  console.log('✔️ Fases criadas com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
