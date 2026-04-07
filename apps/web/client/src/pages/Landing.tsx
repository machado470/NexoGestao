import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  MessageSquare,
  ShieldCheck,
  Users,
  Wallet,
  BarChart3,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConsentBanner } from "@/components/ConsentBanner";
import { TermsModal } from "@/components/TermsModal";

const modules = [
  {
    icon: Users,
    title: "Clientes",
    description:
      "Cadastre clientes, acompanhe histórico e mantenha contexto operacional em um único lugar.",
  },
  {
    icon: Calendar,
    title: "Agenda",
    description:
      "Organize agendamentos, acompanhe compromissos e reduza desencontro no dia a dia.",
  },
  {
    icon: ClipboardList,
    title: "Ordens de serviço",
    description:
      "Controle execução, status e andamento das demandas sem planilha espalhada.",
  },
  {
    icon: Wallet,
    title: "Financeiro",
    description:
      "Visualize cobranças, lançamentos e fluxo financeiro com mais clareza operacional.",
  },
  {
    icon: MessageSquare,
    title: "Comunicação",
    description:
      "Estruture contatos e notificações para não depender só de memória, improviso e boa vontade.",
  },
  {
    icon: BarChart3,
    title: "Visão executiva",
    description:
      "Acompanhe indicadores, gargalos e sinais da operação para decidir sem adivinhar.",
  },
];

const steps = [
  {
    title: "Centralize a base",
    description:
      "Clientes, agenda, ordens e financeiro passam a viver no mesmo ambiente.",
  },
  {
    title: "Execute com contexto",
    description:
      "A equipe trabalha com histórico, status e informação organizada.",
  },
  {
    title: "Acompanhe a operação",
    description:
      "Você enxerga andamento, pendências e pontos de atenção sem caçar dado em vários lugares.",
  },
  {
    title: "Ganhe consistência",
    description:
      "Menos retrabalho, menos improviso e mais previsibilidade na rotina do negócio.",
  },
];

const highlights = [
  "Operação, financeiro e execução em um só lugar",
  "Base pronta para crescer sem virar caos administrativo",
  "Histórico organizado por cliente e processo",
  "Estrutura compatível com automações e governança futura",
];

export default function Landing() {
  const [, navigate] = useLocation();
  const [termsModal, setTermsModal] = useState<"terms" | "privacy" | null>(null);

  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <span className="text-lg font-bold">N</span>
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold leading-none sm:text-base">
                NexoGestão
              </div>
              <div className="text-xs text-muted-foreground">
                operação centralizada de verdade
              </div>
            </div>
          </button>

          <div className="hidden items-center gap-6 md:flex">
            <a href="#como-funciona" className="text-sm text-muted-foreground hover:text-foreground">
              Como funciona
            </a>
            <a href="#modulos" className="text-sm text-muted-foreground hover:text-foreground">
              Módulos
            </a>
            <a href="#diferenciais" className="text-sm text-muted-foreground hover:text-foreground">
              Diferenciais
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button onClick={() => navigate("/register")}>Começar agora</Button>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_30%)]" />
          <div className="container relative py-20 sm:py-24 lg:py-28">
            <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="max-w-3xl">
                <Badge variant="outline" className="mb-5 rounded-full px-3 py-1">
                  <Sparkles className="size-3.5" />
                  Gestão operacional para empresas de serviço
                </Badge>

                <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                  Centralize clientes, agenda, ordens e financeiro em um só lugar
                </h1>

                <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  O NexoGestão organiza a operação do dia a dia com uma base única para
                  atendimento, execução, acompanhamento e visão gerencial. Menos planilha
                  espalhada, menos improviso, mais controle.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    className="gap-2"
                    onClick={() => navigate("/register")}
                  >
                    Começar agora
                    <ArrowRight className="size-4" />
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/login")}
                  >
                    Acessar plataforma
                  </Button>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {highlights.map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-xl border bg-card/70 p-4">
                      <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                      <p className="text-sm text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Card className="overflow-hidden border-border/80 bg-card/90 shadow-xl">
                  <CardHeader className="border-b border-border/70">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl">Visão operacional</CardTitle>
                        <CardDescription>
                          Uma estrutura simples para organizar a rotina sem virar refém do caos.
                        </CardDescription>
                      </div>
                      <Badge>Ativo</Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border bg-background p-4">
                        <div className="text-sm text-muted-foreground">Clientes ativos</div>
                        <div className="mt-2 text-3xl font-semibold">128</div>
                        <div className="mt-2 text-xs text-emerald-600">Base centralizada</div>
                      </div>

                      <div className="rounded-xl border bg-background p-4">
                        <div className="text-sm text-muted-foreground">Ordens em andamento</div>
                        <div className="mt-2 text-3xl font-semibold">24</div>
                        <div className="mt-2 text-xs text-primary">Acompanhamento contínuo</div>
                      </div>

                      <div className="rounded-xl border bg-background p-4">
                        <div className="text-sm text-muted-foreground">Cobranças do período</div>
                        <div className="mt-2 text-3xl font-semibold">R$ 18,4k</div>
                        <div className="mt-2 text-xs text-primary">Mais clareza financeira</div>
                      </div>

                      <div className="rounded-xl border bg-background p-4">
                        <div className="text-sm text-muted-foreground">Status operacional</div>
                        <div className="mt-2 text-3xl font-semibold">Estável</div>
                        <div className="mt-2 text-xs text-violet-600">Rotina com contexto</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-slate-100">
                      <div className="mb-3 flex items-center gap-2 text-sm text-slate-300">
                        <ShieldCheck className="size-4 text-emerald-400" />
                        Organização operacional com base pronta para evoluir
                      </div>
                      <p className="text-sm leading-6 text-slate-300">
                        Estruture o presente sem bloquear o futuro. O produto já nasce com
                        espaço para automação, histórico, acompanhamento e governança.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="border-y bg-muted/30 py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="outline" className="mb-4">
                Como funciona
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Um fluxo simples para organizar a operação
              </h2>
              <p className="mt-4 text-muted-foreground">
                Nada de teatro corporativo. A ideia é tirar a rotina do improviso e colocar
                tudo dentro de um processo mais legível.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-4">
              {steps.map((step, index) => (
                <Card key={step.title} className="border-border/80 bg-card/80 shadow-sm">
                  <CardHeader>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      0{index + 1}
                    </div>
                    <CardTitle>{step.title}</CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="modulos" className="py-20">
          <div className="container">
            <div className="max-w-2xl">
              <Badge variant="outline" className="mb-4">
                Módulos principais
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                As áreas centrais da operação no mesmo ambiente
              </h2>
              <p className="mt-4 text-muted-foreground">
                O foco não é empilhar tela bonita. É fazer a rotina caber em uma estrutura
                que dê contexto, continuidade e visibilidade.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((module) => {
                const Icon = module.icon;

                return (
                  <Card
                    key={module.title}
                    className="border-border/80 bg-card/90 transition-transform duration-200 hover:-translate-y-1 hover:shadow-md"
                  >
                    <CardHeader>
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </div>
                      <CardTitle>{module.title}</CardTitle>
                      <CardDescription>{module.description}</CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section id="diferenciais" className="bg-muted/30 py-20">
          <div className="container">
            <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <Badge variant="outline" className="mb-4">
                  Diferenciais
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Mais clareza operacional. Menos gambiarra administrativa.
                </h2>
                <p className="mt-4 text-muted-foreground">
                  O NexoGestão foi pensado para negócios que precisam organizar a execução
                  sem depender de memória, conversa solta e planilha com vida própria.
                </p>

                <div className="mt-8 space-y-4">
                  {[
                    "Centralização de contexto por cliente, agendamento e execução.",
                    "Base operacional mais preparada para cobrança, acompanhamento e histórico.",
                    "Estrutura útil para crescer com mais consistência antes do caos virar cultura.",
                  ].map((text) => (
                    <div key={text} className="flex items-start gap-3">
                      <ChevronRight className="mt-0.5 size-5 text-primary" />
                      <p className="text-muted-foreground">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Card className="border-border/80 bg-card/90 shadow-lg">
                <CardHeader>
                  <CardTitle>O que melhora na prática</CardTitle>
                  <CardDescription>
                    Menos perda de contexto, mais continuidade operacional.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {[
                    "Clientes melhor organizados",
                    "Agenda mais legível",
                    "Ordens com acompanhamento",
                    "Financeiro menos disperso",
                    "Comunicação mais estruturada",
                    "Visão executiva mais confiável",
                  ].map((item) => (
                    <div key={item} className="rounded-xl border bg-background p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="size-5 text-primary" />
                        <span className="text-sm font-medium">{item}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container">
            <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 via-background to-primary/5 shadow-lg">
              <CardContent className="flex flex-col gap-8 px-6 py-10 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <Badge className="mb-4">Comece com estrutura</Badge>
                  <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    Organize a base operacional antes que a bagunça vire método
                  </h2>
                  <p className="mt-4 text-muted-foreground">
                    Entre na plataforma, crie sua conta e comece com uma estrutura clara para
                    clientes, agenda, execução e financeiro.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" onClick={() => navigate("/register")}>
                    Criar conta
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/login")}>
                    Já tenho acesso
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t bg-background">
        <div className="container flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold">NexoGestão</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Centralização operacional para empresas de serviço.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="hover:text-foreground"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="hover:text-foreground"
            >
              Criar conta
            </button>
            <button
              type="button"
              onClick={() => setTermsModal("terms")}
              className="hover:text-foreground"
            >
              Termos
            </button>
            <button
              type="button"
              onClick={() => setTermsModal("privacy")}
              className="hover:text-foreground"
            >
              Privacidade
            </button>
          </div>
        </div>

        <div className="border-t">
          <div className="container py-4 text-sm text-muted-foreground">
            © {year} NexoGestão. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      <TermsModal
        isOpen={termsModal !== null}
        type={termsModal ?? "terms"}
        onClose={() => setTermsModal(null)}
      />

      <ConsentBanner />
    </div>
  );
}
