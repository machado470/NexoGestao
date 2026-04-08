import { Building2, Compass, ShieldCheck } from "lucide-react";

import { MarketingLayout } from "@/components/MarketingLayout";

import "./landing.css";

export default function About() {
  return (
    <MarketingLayout>
      <section className="container py-14 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.14em] text-orange-600">SOBRE</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900 md:text-5xl">NexoGestão é operação estruturada para empresas de serviço</h1>
          <p className="mt-5 text-lg text-slate-600">Criamos um sistema para reduzir improviso, dar previsibilidade e conectar execução com resultado financeiro.</p>
        </div>
      </section>

      <section className="container pb-16 md:pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Compass,
              title: "Visão",
              text: "Transformar rotinas operacionais em fluxo claro, com responsabilidade e padrão de execução.",
            },
            {
              icon: Building2,
              title: "Foco",
              text: "Empresas de serviço que precisam sair de planilhas e mensagens desconectadas para escalar com controle.",
            },
            {
              icon: ShieldCheck,
              title: "Compromisso",
              text: "Unir operação e financeiro com rastreabilidade para decisões mais seguras no dia a dia.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <div className="inline-flex rounded-xl bg-slate-100 p-2.5 text-slate-700"><Icon className="size-5" /></div>
                <h2 className="mt-4 text-xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>
    </MarketingLayout>
  );
}
