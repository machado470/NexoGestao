import { useLocation } from "wouter";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileSpreadsheet,
  HandCoins,
  MessageCircle,
  Shield,
  Target,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";

import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/MarketingLayout";

import "./landing.css";

const flowItems = [
  { icon: Users, title: "Cliente", subtitle: "Cadastro centralizado" },
  { icon: Calendar, title: "Agendamento", subtitle: "Agenda com prioridade" },
  { icon: Wrench, title: "Ordem Serviço", subtitle: "Execução monitorada" },
  {
    icon: CircleDollarSign,
    title: "Cobrança",
    subtitle: "Fatura sem esquecimento",
  },
  { icon: CreditCard, title: "Pagamento", subtitle: "Baixa em tempo real" },
  { icon: Clock3, title: "Timeline", subtitle: "Rastro operacional" },
  { icon: Shield, title: "Governança", subtitle: "SLA, NPS e controle" },
];

const howSteps = [
  ["Recebe cliente", "Centraliza contato e histórico do atendimento."],
  ["Agenda serviço", "Organiza técnico, data e janela de execução."],
  ["Executa O.S.", "Acompanha status, prioridade e progresso."],
  ["Gera cobrança", "Cria fatura conectada ao serviço executado."],
  ["Recebe pagamento", "Confirma recebimento com rastreabilidade."],
];

const problems = [
  {
    icon: MessageCircle,
    title: "Mensagens no WhatsApp",
    text: "Atendimento e decisão ficam em conversas perdidas e sem histórico operacional.",
  },
  {
    icon: FileSpreadsheet,
    title: "Planilhas desorganizadas",
    text: "Dados críticos ficam espalhados, duplicados e difíceis de confiar.",
  },
  {
    icon: Wrench,
    title: "Operação no improviso",
    text: "Sem fluxo claro, prazos estouram e a execução perde consistência.",
  },
  {
    icon: HandCoins,
    title: "Cobrança esquecida",
    text: "Serviço executado sem cobrança no tempo certo vira perda de caixa.",
  },
];

const benefits = [
  [
    "Pare de perder informação",
    "Cliente, atendimento e execução ficam no mesmo fluxo.",
  ],
  [
    "Saiba o que está acontecendo",
    "Timeline e status mostram cada etapa em tempo real.",
  ],
  [
    "Nunca esqueça de cobrar",
    "Cobrança nasce do serviço executado com rastreio.",
  ],
  [
    "Escale com controle",
    "Governança e indicadores sustentam crescimento sem caos.",
  ],
];

export default function Landing() {
  const [, navigate] = useLocation();
  usePageMeta({
    title: "NexoGestão | Plataforma operacional para empresas de serviço",
    description:
      "Organize atendimento, execução, cobrança e governança em um fluxo único com o NexoGestão.",
  });

  return (
    <MarketingLayout>
      <div>
        <section className="container py-14 md:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-slate-700">
                <span className="h-2 w-2 rounded-full bg-orange-500" />{" "}
                PLATAFORMA OPERACIONAL
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Pare de operar no improviso.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-slate-600">
                Organize atendimento, execução, cobrança e controle em um fluxo
                único.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate("/register")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(249,115,22,0.35)] transition hover:bg-orange-600"
                >
                  Começar avaliação <ArrowRight className="size-4" />
                </button>
                <a
                  href="#fluxo"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-[var(--surface-base)]"
                >
                  Ver como funciona
                </a>
              </div>

              <div className="mt-8 flex items-center gap-4">
                <div className="flex -space-x-3">
                  {["A", "B", "C", "D"].map(i => (
                    <div
                      key={i}
                      className="grid h-10 w-10 place-content-center rounded-full border-2 border-[#f8f9fb] bg-gradient-to-br from-slate-200 to-slate-300 text-xs font-bold text-slate-600"
                    >
                      {i}
                    </div>
                  ))}
                </div>
                <p className="text-sm font-medium text-slate-600">
                  Usado por +320 empresas de serviço
                </p>
              </div>
            </div>

            <div className="hero-stage">
              <article className="hero-card float-a top-0 left-0 w-60">
                <p className="label">Cliente</p>
                <p className="title">Marina Rodrigues</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="chip chip-green">cliente ativo</span>
                  <span className="chip">12 serviços</span>
                </div>
              </article>

              <article className="hero-card float-b top-8 right-0 w-64">
                <div className="mb-3 flex items-center justify-between">
                  <p className="title text-base">Agendamento</p>
                  <span className="chip chip-blue">Hoje</span>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li>09:00 • Vistoria inicial</li>
                  <li>11:30 • Execução técnica</li>
                  <li>15:00 • Fechamento e validação</li>
                </ul>
              </article>

              <article className="hero-card float-c top-40 left-10 w-80">
                <p className="title">Ordem de Serviço #1847</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                  <p>
                    Status:{" "}
                    <span className="font-medium text-violet-600">
                      Em execução
                    </span>
                  </p>
                  <p>Tipo: Manutenção</p>
                  <p>Técnico: Rafael Lima</p>
                  <p>Prioridade: Alta</p>
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Progresso</span>
                    <span>65%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div className="h-2 w-[65%] rounded-full bg-orange-500" />
                  </div>
                </div>
              </article>

              <article className="hero-card float-d top-64 right-10 w-56">
                <p className="title">Cobrança</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  R$ 2.450
                </p>
                <p className="mt-1 text-sm text-slate-500">Vencimento: 14/04</p>
                <span className="chip chip-orange mt-3">Fatura enviada</span>
              </article>

              <article className="hero-card float-b top-96 left-0 w-56">
                <p className="title">Pagamento confirmado</p>
                <p className="mt-1 text-sm text-slate-500">PIX • há 2 min</p>
                <p className="mt-3 font-semibold text-emerald-600">
                  + R$ 2.450,00
                </p>
              </article>

              <article className="hero-card float-a top-[22rem] right-0 w-60">
                <p className="title">Timeline</p>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  <li>• OS criada</li>
                  <li>• Técnico alocado</li>
                  <li>• Pagamento recebido</li>
                </ul>
              </article>

              <article className="hero-card float-c bottom-0 left-24 w-64">
                <p className="title">Governança / SLA</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-lg bg-violet-50 p-2">
                    <p className="font-semibold text-violet-600">97%</p>
                    <p className="text-slate-500">SLA</p>
                  </div>
                  <div className="rounded-lg bg-violet-50 p-2">
                    <p className="font-semibold text-violet-600">74</p>
                    <p className="text-slate-500">NPS</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2">
                    <p className="font-semibold text-emerald-600">2h12</p>
                    <p className="text-slate-500">Tempo médio</p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--border-subtle)] bg-white/70 py-10">
          <div className="container grid gap-6 text-center md:grid-cols-3">
            {[
              ["O.S. PROCESSADAS", "1.2M+"],
              ["VALOR EM COBRANÇAS", "R$ 450M+"],
              ["EXECUÇÃO NO PRAZO", "94%"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs font-semibold tracking-[0.14em] text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="container py-16 md:py-20">
          <h2 className="text-3xl font-semibold text-slate-900 md:text-4xl">
            Sua operação está espalhada — e você sabe disso.
          </h2>
          <p className="mt-3 max-w-3xl text-slate-600">
            Enquanto tenta manter tudo junto, informações críticas se perdem.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {problems.map(problem => {
              const Icon = problem.icon;
              return (
                <article
                  key={problem.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
                >
                  <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-2.5 text-slate-700">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {problem.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">{problem.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section
          id="fluxo"
          className="border-y border-[var(--border-subtle)] bg-white/80 py-16 md:py-20"
        >
          <div className="container">
            <h2 className="text-3xl font-semibold text-slate-900 md:text-4xl">
              O fluxo completo em um único lugar
            </h2>
            <div className="mt-8 overflow-x-auto pb-2">
              <div className="flex min-w-max items-stretch gap-3 pr-2">
                {flowItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <article
                      key={item.title}
                      className="w-52 rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="inline-flex rounded-lg bg-slate-100 p-2 text-slate-700">
                        <Icon className="size-4" />
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-slate-900">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-600">
                        {item.subtitle}
                      </p>
                      {index < flowItems.length - 1 ? (
                        <ArrowRight className="mt-3 size-3 text-slate-400" />
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="container py-16 md:py-20">
          <h2 className="text-3xl font-semibold text-slate-900 md:text-4xl">
            Como funciona
          </h2>
          <p className="mt-3 text-slate-600">
            Cinco passos. Sem complicação. Sua operação flui.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {howSteps.map(([title, text], index) => (
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
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)] md:p-8">
            <div className="border-b border-slate-200 pb-5">
              <h3 className="text-xl font-semibold text-slate-900">
                Marina Rodrigues — OS #1847
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Manutenção preventiva • 08/04/2026 • 09:00
              </p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-[var(--surface-base)] p-4">
                <p className="text-xs text-slate-500">STATUS</p>
                <p className="mt-1 text-lg font-semibold text-blue-600">
                  Em execução
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-[var(--surface-base)] p-4">
                <p className="text-xs text-slate-500">COBRANÇA</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  R$ 2.450 • enviada
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-[var(--surface-base)] p-4">
                <p className="text-xs text-slate-500">PAGAMENTO</p>
                <p className="mt-1 text-lg font-semibold text-emerald-600">
                  PIX confirmado
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/50 p-5">
              <p className="mb-4 text-sm font-semibold text-violet-700">
                Timeline operacional
              </p>
              <div className="space-y-3 text-sm text-slate-700">
                <p>• Ordem criada</p>
                <p>• Técnico alocado</p>
                <p>• Chegada no local</p>
                <p>• Execução completa</p>
                <p>• Pagamento recebido</p>
              </div>
            </div>
          </article>
        </section>

        <section className="container pb-16 md:pb-20">
          <h2 className="text-3xl font-semibold text-slate-900 md:text-4xl">
            Benefícios reais. Visíveis todos os dias.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {benefits.map(([title, text], i) => {
              const icons = [Target, BarChart3, HandCoins, TrendingUp];
              const Icon = icons[i];
              return (
                <article
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="inline-flex rounded-xl bg-slate-100 p-2.5 text-slate-700">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">{text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="container pb-16 md:pb-20">
          <article className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-black p-8 text-white shadow-[0_20px_50px_rgba(2,6,23,0.45)] md:p-10">
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <h2 className="text-3xl font-semibold md:text-4xl">
                  Não é só gestão. É operação estruturada.
                </h2>
                <p className="mt-4 text-slate-300">
                  O sistema não só guarda dados, organiza fluxo operacional real
                  do primeiro atendimento até a governança executiva.
                </p>
                <div className="mt-6 space-y-3">
                  {[
                    "fluxo real cliente → agendamento → execução → cobrança → pagamento",
                    "controle total com timeline, status, SLA e governança",
                    "sem integração macarrônica",
                  ].map(line => (
                    <div
                      key={line}
                      className="flex items-start gap-2 text-sm text-slate-200"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 text-emerald-400" />
                      {line}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-3">
                {[
                  "Operação + Dados",
                  "Velocidade Operacional",
                  "Escala Sem Improviso",
                ].map(card => (
                  <div
                    key={card}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
                  >
                    <p className="font-semibold">{card}</p>
                    <p className="mt-1 text-sm text-slate-300">
                      Painéis conectados com execução real, menos ruído e mais
                      decisão.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section className="container pb-16 md:pb-20">
          <article className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_15px_40px_rgba(15,23,42,0.06)]">
            <h2 className="text-3xl font-semibold text-slate-900">
              Comece simples. Evolua rápido.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              Começa com o básico e evolui para governança, análises e
              integrações.
            </p>
            <div className="mt-6 grid gap-3 text-left md:grid-cols-3">
              {[
                "MONTH 1|Início rápido",
                "MONTH 3|Operação estável",
                "MONTH 6|Evolução contínua",
              ].map(item => {
                const [month, title] = item.split("|");
                return (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-200 bg-[var(--surface-base)] p-4"
                  >
                    <p className="text-xs font-semibold tracking-[0.12em] text-orange-600">
                      {month}
                    </p>
                    <p className="mt-2 font-semibold text-slate-900">{title}</p>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <section className="border-y border-[var(--border-subtle)] bg-white py-16 text-center md:py-20">
          <div className="container">
            <h2 className="mx-auto max-w-4xl text-3xl font-semibold text-slate-900 md:text-5xl">
              Ou você organiza sua operação… ou continua no improviso.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-slate-600">
              Sem fluxo operacional único, sua equipe se perde, o cliente sente,
              a cobrança atrasa e o crescimento trava. Com o NexoGestão,
              atendimento, execução, cobrança e controle trabalham na mesma
              direção.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(249,115,22,0.35)] transition hover:bg-orange-600"
              >
                Começar avaliação
              </button>
              <a
                href="#fluxo"
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-[var(--surface-base)]"
              >
                Ver como funciona
              </a>
            </div>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
