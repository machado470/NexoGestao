import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("\n>> Importando aulas...\n");

  // Buscando fases existentes
  const fases = await prisma.fase.findMany();
  if (!fases.length) {
    console.log("Nenhuma fase encontrada. Importe as perguntas primeiro.");
    return;
  }

  // Exemplo: adicionando aulas somente na Fase 1
  const fase = fases[0];

  const aulas = [
    {
      titulo: "Introdução às Placas de Regulamentação",
      conteudo: `
As placas de regulamentação têm por finalidade informar ao condutor condições,
obrigações, limitações e proibições no uso das vias.

São, em geral, de formatação circular com fundo branco, borda vermelha e pictogramas pretos.

O desrespeito às placas de regulamentação constitui infração de trânsito.
      `,
      ordem: 1,
      videoUrl: "https://www.youtube.com/embed/SYqHYEw0P5M"
    },
    {
      titulo: "Formato e Identificação Visual",
      conteudo: `
As placas de regulamentação seguem padrões definidos pelo CONTRAN:

• Formato circular  
• Bordas vermelhas  
• Fundo branco  
• Símbolos pretos  

Exceções:
• Placa de Parada Obrigatória (R-1) é a única em formato octogonal.  
• "Dê a Preferência" (R-2) é triangular com ponta voltada para baixo.
      `,
      ordem: 2
    },
    {
      titulo: "Principais Placas do Grupo R",
      conteudo: `
Algumas das principais placas de regulamentação:

• R-1: Parada Obrigatória  
• R-2: Dê a Preferência  
• R-3: Sentido Proibido  
• R-6: Estacionamento Regulamentado  
• R-7: Proibido Estacionar  
• R-8: Proibido Parar e Estacionar  

Estas placas possuem significado legal e devem ser obedecidas estritamente.
      `,
      ordem: 3
    }
  ];

  for (const aula of aulas) {
    const result = await prisma.aula.create({
      data: {
        titulo: aula.titulo,
        conteudo: aula.conteudo,
        ordem: aula.ordem,
        videoUrl: aula.videoUrl,
        faseId: fase.id,
      }
    });

    console.log(`Aula criada -> ${result.titulo}`);
  }

  console.log("\n>> Importação de aulas finalizada!\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
