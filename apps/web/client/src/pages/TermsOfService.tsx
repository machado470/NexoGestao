import { MarketingLayout } from "@/components/MarketingLayout";

import "./landing.css";

export default function TermsOfService() {
  return (
    <MarketingLayout>
      <section className="container py-14 md:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.14em] text-orange-600">TERMOS</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900 md:text-5xl">Termos de Uso</h1>
          <p className="mt-4 text-slate-600">Versão inicial para uso responsável da plataforma NexoGestão.</p>

          <article className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.08)] space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-slate-900">Uso da plataforma</h2>
              <p className="mt-2 text-sm text-slate-600">O NexoGestão é destinado à gestão operacional e financeira de empresas de serviço. O uso deve respeitar a legislação vigente e estes termos.</p>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-slate-900">Acesso e conta</h2>
              <p className="mt-2 text-sm text-slate-600">Cada conta é responsável pela guarda de credenciais, pela definição de permissões internas e pela veracidade das informações cadastradas.</p>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-slate-900">Responsabilidades gerais</h2>
              <p className="mt-2 text-sm text-slate-600">Você se compromete a não usar a plataforma para fins ilícitos, violação de direitos de terceiros ou tentativa de acesso indevido ao ambiente de outros clientes.</p>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-slate-900">Limitações gerais</h2>
              <p className="mt-2 text-sm text-slate-600">A disponibilidade da plataforma pode variar por manutenção programada ou fatores externos. O NexoGestão não se responsabiliza por danos indiretos decorrentes de uso indevido ou fora das orientações do produto.</p>
            </section>
            <p className="border-t border-slate-200 pt-6 text-xs text-slate-500">Última atualização: 8 de abril de 2026.</p>
          </article>
        </div>
      </section>
    </MarketingLayout>
  );
}
