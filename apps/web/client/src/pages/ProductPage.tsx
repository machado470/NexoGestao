import {
  ArrowRight,
  Calendar,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Shield,
  Users,
  Wrench,
} from "lucide-react";
import { Link } from "wouter";

import { MarketingLayout } from "@/components/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

import "./landing.css";

const modules = [
  {
    icon: Users,
    title: "Clientes",
    text: "Histórico completo de atendimento, contatos e recorrência em um único cadastro.",
  },
  {
    icon: Calendar,
    title: "Agendamentos",
    text: "Agenda organizada por prioridade, disponibilidade técnica e janela operacional.",
  },
  {
    icon: Wrench,
    title: "Ordens de Serviço",
    text: "Execução monitorada por status, responsável, SLA e evolução da atividade.",
  },
  {
    icon: CircleDollarSign,
    title: "Cobrança",
    text: "Geração de cobrança vinculada ao serviço para reduzir esquecimentos e retrabalho.",
  },
  {
    icon: CreditCard,
    title: "Pagamento",
    text: "Baixa financeira conectada à operação, com registro e rastreabilidade.",
  },
  {
    icon: Clock3,
    title: "Timeline",
    text: "Linha do tempo com eventos-chave do primeiro contato até o pós-serviço.",
  },
  {
    icon: Shield,
    title: "Governança",
    text: "Visão executiva com indicadores operacionais, qualidade e consistência da execução.",
  },
];

const flow = [
  [
    "Cliente",
    "Recebe a solicitação e centraliza dados e histórico no cadastro.",
  ],
  [
    "Agendamento",
    "Define responsável, data e janela com contexto operacional.",
  ],
  [
    "Ordem de Serviço",
    "Acompanha progresso, prioridade e validação de execução.",
  ],
  ["Cobrança", "Gera a cobrança sem desconectar do serviço executado."],
  ["Pagamento", "Confirma recebimento e fecha o ciclo com dados confiáveis."],
  [
    "Timeline + Governança",
    "Consolida rastros para auditoria, melhoria e escala.",
  ],
];

const benefits = [
  "Menos improviso no dia a dia e mais previsibilidade para a equipe.",
  "Redução de perdas financeiras por cobrança fora do tempo.",
  "Decisão mais rápida com operação, financeiro e histórico no mesmo fluxo.",
  "Escalabilidade sem perder controle operacional e padrão de execução.",
];

const trustPillars = [
  {
    title: "Fluxo único com responsabilidade clara",
    text: "Cada etapa operacional possui dono, status e histórico. Isso reduz ruído entre comercial, operação e financeiro.",
  },
  {
    title: "Rastreabilidade para decisão executiva",
    text: "Eventos críticos ficam documentados para auditoria interna, indicadores e revisões de processo.",
  },
  {
    title: "Base escalável sem improviso",
    text: "Adoção progressiva por times e unidades com padrão visual e operacional consistente.",
  },
];

export default function ProductPage() {
  usePageMeta({
    title: "NexoGestão | Produto",
    description:
      "Conheça os módulos do NexoGestão para organizar clientes, agenda, ordens de serviço, cobrança e governança.",
  });
  return (
    <MarketingLayout>
      <section className="container py-14 md:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold tracking-[0.14em] text-orange-600">
            PRODUTO
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900 md:text-5xl">
            Controle sua operação do atendimento ao pagamento
          </h1>
          <p className="mt-5 text-lg text-slate-600">
            O NexoGestão conecta clientes, agendamento, execução, cobrança e
            governança em um fluxo único para operação estruturada de verdade.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(249,115,22,0.35)] transition hover:bg-orange-600"
            >
              Começar agora <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/funcionalidades"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-[var(--surface-base)]"
            >
              Explorar funcionalidades
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--border-subtle)] bg-white/80 py-16 md:py-20">
        <div className="container">
          <h2 className="text-3xl font-semibold text-slate-900 md:text-4xl">
            Módulos integrados do sistema
          </h2>
          <p className="mt-3 max-w-3xl text-slate-600">
            Cada módulo resolve uma etapa crítica do serviço, sem ilhas de
            informação.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map(module => {
              const Icon = module.icon;
              return (
                <article
                  key={module.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
                >
                  <div className="inline-flex rounded-xl bg-slate-100 p-2.5 text-slate-700">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">
                    {module.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">{module.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container py-16 md:py-20">
        <h2 className="text-3xl font-semibold text-slate-900 md:text-4xl">
          Fluxo do produto, ponta a ponta
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {flow.map(([title, text], index) => (
            <article
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 font-semibold text-white">
                {index + 1}
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900">
                {title}
              </h3>
              <p className="mt-2 text-sm text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container pb-16 md:pb-20">
        <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_45px_rgba(15,23,42,0.08)] md:p-10">
          <h2 className="text-3xl font-semibold text-slate-900">
            Benefícios operacionais no dia a dia
          </h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {benefits.map(item => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-[var(--surface-base)] p-4 text-sm text-slate-700"
              >
                • {item}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/contato"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-black"
            >
              Solicitar demonstração
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-[var(--surface-base)]"
            >
              Começar avaliação
            </Link>
          </div>
        </article>
      </section>

      <section className="border-t border-[var(--border-subtle)] bg-white/80 py-16 md:py-20">
        <div className="container">
          <h2 className="text-3xl font-semibold text-slate-900 md:text-4xl">
            Estrutura para operação com padrão institucional
          </h2>
          <p className="mt-3 max-w-3xl text-slate-600">
            O produto foi desenhado para empresas que precisam transmitir
            previsibilidade para equipe, liderança e clientes finais.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {trustPillars.map(item => (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <h3 className="text-base font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
