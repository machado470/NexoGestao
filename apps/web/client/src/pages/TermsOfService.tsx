import { MarketingLayout } from "@/components/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

import "./landing.css";

const sections = [
  {
    title: "1. Visão geral do serviço",
    text: "O NexoGestão é uma plataforma SaaS para gestão operacional de empresas de serviço. Estes termos descrevem regras de acesso, responsabilidades e limites de uso para preservar segurança, continuidade e conformidade contratual.",
  },
  {
    title: "2. Uso da plataforma",
    text: "O cliente deve utilizar o sistema apenas para finalidades empresariais legítimas. É proibido uso para fraude, tentativa de acesso indevido, coleta abusiva de dados, violação de propriedade intelectual ou qualquer atividade em desacordo com a legislação aplicável.",
  },
  {
    title: "3. Conta, credenciais e permissões",
    text: "A organização contratante é responsável pela gestão dos usuários internos, pela definição de perfis de acesso e pela guarda das credenciais. Compartilhamento indevido de senha, uso não autorizado ou cadastro com informações falsas viola estes termos.",
  },
  {
    title: "4. Responsabilidades do cliente",
    text: "Cabe ao cliente manter dados atualizados, validar informações operacionais registradas na plataforma e observar obrigações legais sobre atendimento, faturamento e relação com seus próprios consumidores. O conteúdo inserido no ambiente é de responsabilidade da organização usuária.",
  },
  {
    title: "5. Privacidade e tratamento de dados",
    text: "As práticas de tratamento de dados pessoais seguem a Política de Privacidade vigente. O cliente deve garantir base legal adequada para inserir dados de terceiros na plataforma e adotar controles internos compatíveis com sua operação.",
  },
  {
    title: "6. Disponibilidade e manutenção",
    text: "O serviço pode passar por manutenções evolutivas, preventivas ou corretivas. Sempre que possível, janelas programadas são comunicadas previamente. Eventos externos de infraestrutura, rede ou terceiros podem impactar disponibilidade sem caracterizar inadimplemento automático.",
  },
  {
    title: "7. Propriedade intelectual",
    text: "Código, interface, identidade visual, fluxos e conteúdos institucionais do NexoGestão permanecem sob titularidade da plataforma e seus licenciadores. Não é permitido copiar, descompilar, revender ou explorar comercialmente o produto sem autorização formal.",
  },
  {
    title: "8. Limitações de responsabilidade",
    text: "O NexoGestão não responde por danos indiretos, lucros cessantes, perda de oportunidade ou prejuízos decorrentes de uso inadequado da ferramenta, indisponibilidade de serviços externos ou falhas de operação interna do próprio cliente.",
  },
  {
    title: "9. Encerramento e suspensão",
    text: "Contas podem ser suspensas ou encerradas em caso de violação destes termos, risco de segurança, suspeita de fraude ou exigência legal. O cliente também pode solicitar encerramento conforme canal de atendimento contratual.",
  },
  {
    title: "10. Atualizações destes termos",
    text: "Estes termos podem ser atualizados para refletir evolução do produto, ajustes legais e melhorias operacionais. A versão vigente será sempre publicada nesta página com data de última atualização.",
  },
];

export default function TermsOfService() {
  usePageMeta({
    title: "NexoGestão | Termos de Uso",
    description:
      "Leia os termos de uso do NexoGestão para entender regras de acesso, responsabilidades e condições gerais da plataforma.",
  });

  return (
    <MarketingLayout>
      <section className="container py-14 md:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.14em] text-orange-600">BASE LEGAL</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900 md:text-5xl">Termos de Uso</h1>
          <p className="mt-4 text-base text-slate-600 md:text-lg">
            Documento institucional com as diretrizes de uso do NexoGestão. Recomendamos leitura completa antes
            da utilização contínua da plataforma.
          </p>

          <article className="mt-8 space-y-7 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-10">
            {sections.map(section => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600 md:text-[15px]">{section.text}</p>
              </section>
            ))}

            <section className="rounded-2xl border border-slate-200 bg-[var(--surface-base)] p-5">
              <h2 className="text-lg font-semibold text-slate-900">Contato institucional</h2>
              <p className="mt-2 text-sm text-slate-600">
                Dúvidas sobre estes termos podem ser encaminhadas para{" "}
                <a className="font-semibold text-slate-900" href="mailto:juridico@nexogestao.com.br">
                  juridico@nexogestao.com.br
                </a>{" "}
                ou via página de contato.
              </p>
            </section>

            <p className="border-t border-slate-200 pt-6 text-xs text-slate-500">Última atualização: 9 de abril de 2026.</p>
          </article>
        </div>
      </section>
    </MarketingLayout>
  );
}
