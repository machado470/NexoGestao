import {
  ArrowRight,
  Bot,
  Calendar,
  Clock3,
  FileBarChart2,
  HandCoins,
  MessageCircle,
  Shield,
  Users,
  Wrench,
} from "lucide-react";
import { Link } from "wouter";

import { MarketingLayout } from "@/components/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

import "./landing.css";

const features = [
  {
    icon: Users,
    title: "Clientes",
    text: "Cadastro unificado com histórico, contatos, recorrência e contexto de atendimento.",
  },
  {
    icon: Calendar,
    title: "Agenda",
    text: "Planejamento por janela, prioridade e responsável para reduzir conflitos de execução.",
  },
  {
    icon: Wrench,
    title: "Ordens de serviço",
    text: "Fluxo de abertura, execução e conclusão com status e responsáveis claros.",
  },
  {
    icon: HandCoins,
    title: "Financeiro",
    text: "Cobranças e recebimentos conectados ao serviço para evitar perda de receita.",
  },
  {
    icon: Clock3,
    title: "Timeline",
    text: "Rastreabilidade dos eventos importantes para auditoria e melhoria contínua.",
  },
  {
    icon: Shield,
    title: "Governança",
    text: "Indicadores operacionais, visão de qualidade, SLA e controle executivo.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    text: "Canal de comunicação integrado à operação para manter histórico contextual.",
  },
  {
    icon: FileBarChart2,
    title: "Relatórios",
    text: "Consolidação de desempenho para decisões de capacidade, margem e eficiência.",
  },
  {
    icon: Bot,
    title: "Automações futuras",
    text: "Base preparada para automações operacionais com regras e gatilhos por etapa.",
  },
];

const operatingOutcomes = [
  "Redução de retrabalho na abertura e execução de ordens.",
  "Maior previsibilidade de agenda e alocação técnica.",
  "Cobrança mais disciplinada após serviço concluído.",
  "Visão gerencial com dados mais confiáveis para priorização.",
];

export default function FunctionalitiesPage() {
  usePageMeta({
    title: "NexoGestão | Funcionalidades",
    description:
      "Explore as funcionalidades do NexoGestão: clientes, agenda, ordens de serviço, financeiro, timeline, governança, WhatsApp e relatórios.",
  });

  return (
    <MarketingLayout>
      <section className="container py-14 md:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold tracking-[0.14em] text-orange-600">
            FUNCIONALIDADES
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900 md:text-5xl">
            Recursos práticos para organizar a operação inteira
          </h1>
          <p className="mt-5 text-lg text-slate-600">
            Cada funcionalidade do NexoGestão resolve uma dor específica sem
            quebrar o fluxo de ponta a ponta da empresa de serviços.
          </p>
        </div>
      </section>

      <section className="container pb-16 md:pb-20">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map(feature => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
              >
                <div className="inline-flex rounded-xl bg-slate-100 p-2.5 text-slate-700">
                  <Icon className="size-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">
                  {feature.title}
                </h2>
                <p className="mt-2 text-sm text-slate-600">{feature.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="container pb-16 md:pb-20">
        <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_45px_rgba(15,23,42,0.08)] md:p-10">
          <h2 className="text-3xl font-semibold text-slate-900">
            Quer ver esses recursos aplicados ao seu cenário?
          </h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            Agende uma demonstração para mapear o fluxo atual da sua empresa e
            configurar um plano de adoção com foco em resultado operacional.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/contato"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-black"
            >
              Agendar demonstração
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(249,115,22,0.35)] transition hover:bg-orange-600"
            >
              Começar avaliação <ArrowRight className="size-4" />
            </Link>
          </div>
        </article>
      </section>

      <section className="container pb-16 md:pb-20">
        <article className="rounded-3xl border border-slate-200 bg-[var(--surface-base)] p-8 md:p-10">
          <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">
            Resultado esperado com adoção consistente
          </h2>
          <p className="mt-3 max-w-3xl text-slate-600">
            As funcionalidades entregam valor real quando usadas em conjunto,
            dentro do fluxo operacional da empresa.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {operatingOutcomes.map(item => (
              <div
                key={item}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              >
                • {item}
              </div>
            ))}
          </div>
        </article>
      </section>
    </MarketingLayout>
  );
}
