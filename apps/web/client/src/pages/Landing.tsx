import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Coins,
  CreditCard,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
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

const coreFlow = [
  { icon: Users, title: "Cliente", subtitle: "Cadastro vivo com histórico e contexto" },
  { icon: Calendar, title: "Agendamento", subtitle: "Compromisso registrado com dono e status" },
  { icon: ClipboardList, title: "O.S.", subtitle: "Execução operacional sem perder o fio" },
  { icon: Coins, title: "Cobrança", subtitle: "Receita gerada já conectada à operação" },
  { icon: CreditCard, title: "Pagamento", subtitle: "Baixa financeira com rastreabilidade" },
  { icon: Timer, title: "Timeline", subtitle: "Linha do tempo auditável da jornada" },
  { icon: ShieldCheck, title: "Governança", subtitle: "Risco, pendências e alçadas com clareza" },
];

const benefits = [
  {
    title: "Menos retrabalho administrativo",
    description:
      "Sem caça a informação no WhatsApp, planilha e caderno. O time trabalha com um fluxo único.",
  },
  {
    title: "Decisão com contexto real",
    description:
      "Painel executivo, timeline e governança ajudam a agir antes da operação virar incêndio.",
  },
  {
    title: "Receita mais previsível",
    description:
      "Cobrança e pagamento conectados ao serviço executado melhoram visibilidade de caixa e follow-up.",
  },
  {
    title: "Pronto para crescimento",
    description:
      "Estrutura preparada para equipe, papéis, trilhas de onboarding e evolução sem improviso eterno.",
  },
];

const differentials = [
  "Produto orientado para empresa de serviço (não é ERP genérico com mil módulos vazios)",
  "Fluxo ponta a ponta: cliente → agenda → O.S. → financeiro → governança",
  "Onboarding operacional guiado para acelerar primeiros resultados",
  "Base com trilha de auditoria e visão executiva para gestão madura",
];

const faqItems = [
  {
    question: "Para quem o NexoGestão foi desenhado?",
    answer:
      "Para operações de serviço que cresceram no improviso e agora precisam de rotina previsível, controle de execução e visão financeira conectada.",
  },
  {
    question: "Preciso trocar toda a operação de uma vez?",
    answer:
      "Não. Você pode começar com o fluxo principal (cliente, agenda, O.S. e cobrança) e expandir para governança conforme o time ganha tração.",
  },
  {
    question: "Como fica o onboarding da equipe?",
    answer:
      "O produto já possui etapas de onboarding e status por organização para guiar a adoção e evitar que usuários caiam no dashboard sem contexto.",
  },
  {
    question: "O produto já está pronto para uso comercial?",
    answer:
      "Sim. O foco atual é consolidar funil público/auth, onboarding e experiência mobile para suportar entrada de clientes pagantes com segurança.",
  },
];

export default function Landing() {
  const [, navigate] = useLocation();
  const [termsModal, setTermsModal] = useState<"terms" | "privacy" | null>(null);
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <span className="text-lg font-bold">N</span>
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold leading-none sm:text-base">NexoGestão</div>
              <div className="text-xs text-muted-foreground">produto de gestão operacional</div>
            </div>
          </button>

          <div className="hidden items-center gap-6 md:flex">
            <a href="#fluxo" className="text-sm text-muted-foreground hover:text-foreground">
              Fluxo
            </a>
            <a href="#beneficios" className="text-sm text-muted-foreground hover:text-foreground">
              Benefícios
            </a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground">
              FAQ
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate("/login")}>Entrar</Button>
            <Button onClick={() => navigate("/register")}>Começar avaliação</Button>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_30%)]" />
          <div className="container relative py-16 sm:py-20 lg:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="max-w-3xl">
                <Badge variant="outline" className="mb-5 rounded-full px-3 py-1">
                  <Sparkles className="size-3.5" />
                  Gestão operacional + financeira para empresas de serviço
                </Badge>

                <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                  Transforme operação dispersa em um fluxo confiável e vendável
                </h1>

                <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  O NexoGestão organiza atendimento, execução, cobrança e governança com uma trilha única.
                  É o caminho para sair do improviso e operar com padrão de produto real.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" className="gap-2" onClick={() => navigate("/register")}>
                    Começar agora
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/login")}>
                    Já tenho conta
                  </Button>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {[
                    "Autenticação com fluxo de verificação por e-mail",
                    "Onboarding guiado para primeira experiência",
                    "Visão executiva e governança operacional",
                    "Experiência otimizada para desktop e mobile",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-xl border bg-card/70 p-4">
                      <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                      <p className="text-sm text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Card className="border-border/80 bg-card/95 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-xl">Painel de execução da operação</CardTitle>
                  <CardDescription>
                    Dados de exemplo para visualizar rotina, receita e risco em um único ambiente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">Clientes ativos</p>
                    <p className="mt-2 text-2xl font-semibold">148</p>
                  </div>
                  <div className="rounded-xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">O.S. em andamento</p>
                    <p className="mt-2 text-2xl font-semibold">29</p>
                  </div>
                  <div className="rounded-xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">Cobranças abertas</p>
                    <p className="mt-2 text-2xl font-semibold">R$ 26,3k</p>
                  </div>
                  <div className="rounded-xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">Risco operacional</p>
                    <p className="mt-2 text-2xl font-semibold">Controlado</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="fluxo" className="py-16 sm:py-20">
          <div className="container">
            <div className="max-w-3xl">
              <Badge variant="outline" className="mb-4">Fluxo operacional do produto</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Cliente → Agendamento → O.S. → Cobrança → Pagamento → Timeline → Governança
              </h2>
              <p className="mt-4 text-muted-foreground">
                Esse fluxo conecta ponta a ponta da operação. Cada etapa alimenta a próxima e fortalece a visão gerencial.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {coreFlow.map((step, index) => {
                const Icon = step.icon;
                const isLast = index === coreFlow.length - 1;
                return (
                  <Card key={step.title} className="border-border/80 bg-card/90 shadow-sm">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="size-5" />
                        </div>
                        {!isLast ? <ChevronRight className="size-4 text-muted-foreground" /> : null}
                      </div>
                      <CardTitle>{step.title}</CardTitle>
                      <CardDescription>{step.subtitle}</CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section id="beneficios" className="border-y bg-muted/30 py-16 sm:py-20">
          <div className="container">
            <div className="max-w-2xl">
              <Badge variant="outline" className="mb-4">Benefícios reais</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Não é só software bonito: é ganho operacional no dia a dia
              </h2>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {benefits.map((benefit) => (
                <Card key={benefit.title} className="border-border/80 bg-card/95">
                  <CardHeader>
                    <CardTitle className="text-xl">{benefit.title}</CardTitle>
                    <CardDescription>{benefit.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="container grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Badge variant="outline" className="mb-4">Diferenciais</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Posicionamento premium com foco em confiança operacional
              </h2>
              <div className="mt-6 space-y-3">
                {differentials.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-xl border bg-card/80 p-4">
                    <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                    <p className="text-sm text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <Card className="border-border/80 bg-slate-950 text-slate-100 shadow-xl">
              <CardHeader>
                <CardTitle>Pronto para vender com confiança</CardTitle>
                <CardDescription className="text-slate-300">
                  Funil público, autenticação e onboarding alinhados para converter sem quebrar experiência.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-slate-300">
                  <p>• Verificação de e-mail com regras de rollout seguro.</p>
                  <p>• Fluxos públicos padronizados com mensagens claras.</p>
                  <p>• Jornada inicial orientada por onboarding.status.</p>
                  <p>• Camada BFF alinhada com API para evitar comportamento divergente.</p>
                </div>
                <Button className="mt-6 w-full" onClick={() => navigate("/register")}>
                  Iniciar onboarding comercial
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="faq" className="border-t py-16 sm:py-20">
          <div className="container">
            <div className="max-w-2xl">
              <Badge variant="outline" className="mb-4">
                <HelpCircle className="size-3.5" />
                FAQ
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Perguntas frequentes</h2>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {faqItems.map((item) => (
                <Card key={item.question} className="border-border/80 bg-card/95">
                  <CardHeader>
                    <CardTitle className="text-lg">{item.question}</CardTitle>
                    <CardDescription>{item.answer}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/40 py-14">
          <div className="container text-center">
            <h3 className="text-2xl font-bold">Sua operação merece processo, previsibilidade e governança.</h3>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Comece agora e veja o NexoGestão funcionar como plataforma operacional completa, não como mais uma ferramenta isolada.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={() => navigate("/register")}>Criar conta</Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/login")}>
                Entrar na plataforma
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
          <p>© {year} NexoGestão. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <button type="button" className="hover:text-foreground" onClick={() => setTermsModal("terms")}>Termos</button>
            <button type="button" className="hover:text-foreground" onClick={() => setTermsModal("privacy")}>Privacidade</button>
          </div>
        </div>
      </footer>

      <ConsentBanner />
      <TermsModal
        isOpen={termsModal !== null}
        type={termsModal === "privacy" ? "privacy" : "terms"}
        onClose={() => setTermsModal(null)}
      />
    </div>
  );
}
