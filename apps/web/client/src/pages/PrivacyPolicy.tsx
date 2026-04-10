import { MarketingLayout } from "@/components/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

import "./landing.css";

const sections = [
  {
    title: "1. Visão geral",
    text: "Esta Política de Privacidade explica como o NexoGestão coleta, usa, armazena e protege dados pessoais e operacionais processados durante o uso da plataforma.",
  },
  {
    title: "2. Dados tratados",
    text: "Podemos tratar dados de cadastro de usuários (nome, e-mail, telefone), dados de empresas e dados operacionais inseridos pelo cliente (clientes finais, agenda, ordens de serviço, lançamentos financeiros e histórico de execução).",
  },
  {
    title: "3. Finalidades de tratamento",
    text: "Os dados são utilizados para autenticação, operação das funcionalidades, prevenção a abuso, suporte técnico, evolução de performance e cumprimento de obrigações legais aplicáveis.",
  },
  {
    title: "4. Compartilhamento de dados",
    text: "O NexoGestão não comercializa dados pessoais. O compartilhamento ocorre somente com fornecedores necessários para hospedagem, segurança, comunicação e operação da plataforma, sempre sob critérios contratuais e de proteção de dados.",
  },
  {
    title: "5. Cookies e tecnologias similares",
    text: "Utilizamos cookies e identificadores técnicos para manter sessão autenticada, preferências de navegação e medições essenciais de estabilidade. O usuário pode gerenciar cookies no navegador, observando possível impacto em funcionalidades.",
  },
  {
    title: "6. Retenção e descarte",
    text: "Os dados são mantidos pelo período necessário para execução do serviço, cumprimento de obrigações regulatórias e defesa de direitos. Após esse período, os dados podem ser excluídos ou anonimizados conforme políticas internas.",
  },
  {
    title: "7. Segurança da informação",
    text: "Adotamos controles técnicos e administrativos para proteger dados contra acesso não autorizado, perda, alteração ou divulgação indevida, incluindo criptografia em trânsito, controle de acesso e trilhas de auditoria.",
  },
  {
    title: "8. Direitos do titular",
    text: "Quando aplicável, titulares de dados podem solicitar confirmação de tratamento, atualização, correção, anonimização ou exclusão de dados pessoais, respeitados limites legais e contratuais.",
  },
  {
    title: "9. Contato para privacidade",
    text: "Demandas de privacidade podem ser enviadas para privacy@nexogestao.com.br. O time responsável avalia cada solicitação com base na legislação aplicável e no contexto contratual.",
  },
  {
    title: "10. Atualizações desta política",
    text: "Esta política pode ser revisada para refletir melhorias no produto, novas exigências regulatórias ou ajustes operacionais. A versão vigente ficará disponível nesta página com data de atualização.",
  },
];

export default function PrivacyPolicy() {
  usePageMeta({
    title: "NexoGestão | Política de Privacidade",
    description:
      "Conheça como o NexoGestão trata dados pessoais e operacionais com foco em segurança, transparência e conformidade.",
  });

  return (
    <MarketingLayout>
      <section className="container py-14 md:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.14em] text-orange-600">BASE LEGAL</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900 md:text-5xl">Política de Privacidade</h1>
          <p className="mt-4 text-base text-slate-600 md:text-lg">
            Estrutura oficial de tratamento de dados do NexoGestão para clientes, usuários e visitantes do ambiente
            público.
          </p>

          <article className="mt-8 space-y-7 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-10">
            {sections.map(section => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600 md:text-[15px]">{section.text}</p>
              </section>
            ))}

            <section className="rounded-2xl border border-slate-200 bg-[var(--surface-base)] p-5">
              <h2 className="text-lg font-semibold text-slate-900">Canal de atendimento</h2>
              <p className="mt-2 text-sm text-slate-600">
                Para dúvidas sobre proteção de dados, entre em contato em{" "}
                <a className="font-semibold text-slate-900" href="mailto:privacy@nexogestao.com.br">
                  privacy@nexogestao.com.br
                </a>{" "}
                ou pela página de contato institucional.
              </p>
            </section>

            <p className="border-t border-slate-200 pt-6 text-xs text-slate-500">Última atualização: 9 de abril de 2026.</p>
          </article>
        </div>
      </section>
    </MarketingLayout>
  );
}
