import { MarketingLayout } from "@/components/MarketingLayout";

import "./landing.css";

export default function PrivacyPolicy() {
  return (
    <MarketingLayout>
      <section className="container py-14 md:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.14em] text-orange-600">PRIVACIDADE</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900 md:text-5xl">Política de Privacidade</h1>
          <p className="mt-4 text-slate-600">Versão inicial objetiva sobre tratamento de dados no NexoGestão.</p>

          <article className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.08)] space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-slate-900">Dados coletados</h2>
              <p className="mt-2 text-sm text-slate-600">Coletamos dados de conta (nome, email, telefone), dados operacionais cadastrados por você (clientes, agendamentos, ordens de serviço, financeiro) e registros técnicos de acesso para segurança.</p>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-slate-900">Finalidade de uso</h2>
              <p className="mt-2 text-sm text-slate-600">Usamos os dados para operar a plataforma, melhorar estabilidade, enviar comunicações essenciais do serviço e cumprir obrigações legais e regulatórias.</p>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-slate-900">Armazenamento e proteção</h2>
              <p className="mt-2 text-sm text-slate-600">Os dados são armazenados em infraestrutura com controles de acesso, criptografia em trânsito e práticas de monitoramento. Mantemos dados pelo período necessário para prestação do serviço e exigências legais.</p>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-slate-900">Contato</h2>
              <p className="mt-2 text-sm text-slate-600">Solicitações sobre privacidade podem ser enviadas para <a className="font-semibold text-slate-900" href="mailto:privacy@nexogestao.com.br">privacy@nexogestao.com.br</a>.</p>
            </section>
            <p className="border-t border-slate-200 pt-6 text-xs text-slate-500">Última atualização: 8 de abril de 2026.</p>
          </article>
        </div>
      </section>
    </MarketingLayout>
  );
}
