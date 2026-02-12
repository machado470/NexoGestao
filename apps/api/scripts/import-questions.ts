import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("\n>> Importando categorias, fases e questões...\n");

  const data = [
    {
      name: "Sinalização",
      phases: [
        {
          name: "Placas de regulamentação",
          questions: [
            {
              statement: "Qual cor indica placa de atenção?",
              answers: [
                { text: "Amarela", isCorrect: true },
                { text: "Vermelha", isCorrect: false },
                { text: "Azul", isCorrect: false },
                { text: "Verde", isCorrect: false }
              ]
            }
          ]
        },
        { name: "Placas de advertência", questions: [] },
        { name: "Placas de indicação", questions: [] }
      ]
    }
  ];

  for (const category of data) {
    const cat = await prisma.categoria.upsert({
      where: { nome: category.name },
      update: {},
      create: { nome: category.name }
    });

    console.log(`Categoria OK -> ${cat.nome} (id ${cat.id})`);

    for (const phase of category.phases) {
      const ph = await prisma.fase.upsert({
        where: {
          titulo_categoriaId: {
            titulo: phase.name,
            categoriaId: cat.id
          }
        },
        update: {},
        create: {
          titulo: phase.name,
          categoriaId: cat.id
        }
      });

      console.log(`  Fase OK -> ${ph.titulo} (id ${ph.id})`);

      for (const q of phase.questions) {
        const correctAnswer =
          q.answers.find(a => a.isCorrect)?.text ?? q.answers[0].text;

        await prisma.pergunta.create({
          data: {
            enunciado: q.statement,
            categoriaId: cat.id,
            faseId: ph.id,

            alternativaA: q.answers[0].text,
            alternativaB: q.answers[1].text,
            alternativaC: q.answers[2].text,
            alternativaD: q.answers[3].text,

            correta: correctAnswer
          }
        });

        console.log(`      Questão criada -> ${q.statement}`);
      }
    }
  }

  console.log("\n>> Importação finalizada!\n");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
