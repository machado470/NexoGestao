import { Building2, Compass, ShieldCheck, Users2 } from "lucide-react";
import { Link } from "wouter";

import { MarketingLayout } from "@/components/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

import "./landing.css";

const pillars = [
  {
    icon: Compass,
    title: "Visão",
    text: "Transformar rotinas operacionais em fluxo claro, com responsabilidade, previsibilidade e padrão de execução.",
  },
  {
    icon: Building2,
    title: "Foco",
    text: "Empresas de serviço que precisam sair de planilhas e mensagens desconectadas para crescer com controle.",
  },
  {
    icon: ShieldCheck,
    title: "Compromisso",
    text: "Unir operação e financeiro com rastreabilidade para decisões mais seguras no dia a dia.",
  },
];

const principles = [
  "Clareza operacional antes de complexidade desnecessária.",
  "Dados confiáveis para acompanhamento de ponta a ponta.",
  "Experiência consistente entre áreas públicas, autenticação e produto.",
  "Evolução contínua guiada por uso real de empresas de serviço.",
];

export default function About() {
  usePageMeta({
    title: "NexoGestão | Sobre",
    description:
      "Conheça a visão do NexoGestão para transformar operações de serviços em fluxos estruturados e rastreáveis.",
  });

  return (
    <MarketingLayout>
      <section className="container py-14 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.14em] text-orange-600">SOBRE</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900 md:text-5xl">
            NexoGestão é operação estruturada para empresas de serviço
          </h1>
          <p className="mt-5 text-lg text-slate-600">
            Construímos uma plataforma para reduzir improviso, dar previsibilidade e conectar execução com resultado
            financeiro.
          </p>
        </div>
      </section>

      <section className="container pb-16 md:pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          {pillars.map(item => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
              >
                <div className="inline-flex rounded-xl bg-slate-100 p-2.5 text-slate-700">
                  <Icon className="size-5" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="container pb-16 md:pb-20">
        <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_45px_rgba(15,23,42,0.08)] md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-[var(--surface-base)] px-3 py-1 text-xs font-semibold text-slate-700">
            <Users2 className="size-3.5" /> Diretrizes institucionais
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900">Como pensamos produto e relacionamento</h2>
          <ul className="mt-6 space-y-3 text-sm text-slate-600">
            {principles.map(item => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/contato"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-black"
            >
              Falar com a equipe
            </Link>
            <Link
              href="/produto"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-[var(--surface-base)]"
            >
              Conhecer o produto
            </Link>
          </div>
        </article>
      </section>
    </MarketingLayout>
  );
}
