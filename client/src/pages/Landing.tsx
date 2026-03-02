import { useLocation } from "wouter";
import { ArrowRight, CheckCircle, Users, BarChart3, Shield, Zap, MessageSquare, TrendingUp, Lock, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
              N
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">NexoGestão</span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/login")}
              className="text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 font-medium transition"
            >
              Entrar
            </button>
            <Button
              onClick={() => navigate("/register")}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition"
            >
              Começar Grátis
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-pulse"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-pulse delay-2000"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-block mb-6 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 rounded-full border border-orange-200 dark:border-orange-800">
                <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">✨ Gestão Operacional Inteligente</span>
              </div>
              <h1 className="text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
                Seu negócio sob <span className="bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">controle total</span>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400 mb-10 leading-relaxed">
                Centralize clientes, agendamentos, ordens de serviço e finanças. Com governança inteligente, análise de risco em tempo real e sistema de referências que gera receita.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Button
                  onClick={() => navigate("/register")}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-8 py-4 text-lg font-semibold flex items-center justify-center shadow-xl hover:shadow-2xl transition"
                >
                  Começar Grátis <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  className="border-2 border-gray-300 dark:border-gray-700 px-8 py-4 text-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  Ver Demo
                </Button>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-6 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Sem cartão de crédito
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Setup em 2 minutos
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Suporte 24/7
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 rounded-2xl blur-2xl opacity-30"></div>
              <div className="relative bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-slate-700">
                <div className="space-y-4">
                  <div className="h-3 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full w-3/4"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full w-full"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full w-5/6"></div>
                  <div className="pt-6 grid grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-800/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">1.2K</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Clientes</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">$48K</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Receita</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">98%</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Satisfação</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Funcionalidades poderosas para empresas que querem crescer
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature Cards */}
            {[
              {
                icon: Users,
                title: "Gestão de Clientes",
                description: "Centralize informações, histórico e preferências de clientes",
                color: "from-orange-500 to-orange-600",
                lightColor: "bg-orange-50 dark:bg-orange-900/20",
              },
              {
                icon: BarChart3,
                title: "Análise Financeira",
                description: "Gráficos em tempo real, previsões e relatórios detalhados",
                color: "from-blue-500 to-blue-600",
                lightColor: "bg-blue-50 dark:bg-blue-900/20",
              },
              {
                icon: Shield,
                title: "Governança Inteligente",
                description: "Análise de risco automática e alertas de conformidade",
                color: "from-green-500 to-green-600",
                lightColor: "bg-green-50 dark:bg-green-900/20",
              },
              {
                icon: Zap,
                title: "Automações",
                description: "Workflows automáticos para economizar tempo e reduzir erros",
                color: "from-yellow-500 to-yellow-600",
                lightColor: "bg-yellow-50 dark:bg-yellow-900/20",
              },
              {
                icon: MessageSquare,
                title: "WhatsApp Integrado",
                description: "Comunique-se com clientes diretamente pela plataforma",
                color: "from-green-400 to-green-500",
                lightColor: "bg-green-50 dark:bg-green-900/20",
              },
              {
                icon: TrendingUp,
                title: "Sistema de Referências",
                description: "Ganhe créditos indicando clientes e crescendo juntos",
                color: "from-purple-500 to-purple-600",
                lightColor: "bg-purple-50 dark:bg-purple-900/20",
              },
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={idx}
                  className="group relative bg-white dark:bg-slate-800 rounded-2xl p-8 border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity`}></div>
                  <div className={`${feature.lightColor} w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-7 h-7 bg-gradient-to-r ${feature.color} bg-clip-text text-transparent`} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section Preview */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50 dark:from-slate-900 dark:to-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Planos para todos os tamanhos
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Comece grátis, escale conforme sua empresa cresce
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { name: "Gratuito", price: "R$ 0", features: ["5 clientes", "10 agendamentos", "Básico"] },
              { name: "Pro", price: "R$ 99", features: ["50 clientes", "100 agendamentos", "WhatsApp", "Relatórios"], highlight: true },
              { name: "Enterprise", price: "R$ 299", features: ["Ilimitado", "Ilimitado", "Tudo", "API + SSO"] },
            ].map((plan, idx) => (
              <div
                key={idx}
                className={`relative rounded-2xl p-8 border-2 transition-all ${
                  plan.highlight
                    ? "border-orange-500 bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-slate-800 shadow-2xl scale-105"
                    : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <span className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-1 rounded-full text-sm font-bold">
                      Mais Popular
                    </span>
                  </div>
                )}
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                    {plan.price}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">/mês</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full py-3 font-semibold ${
                    plan.highlight
                      ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg"
                      : "border-2 border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700"
                  }`}
                >
                  Escolher Plano
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-3xl p-12 md:p-16 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full -ml-20 -mb-20"></div>

            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Pronto para transformar seu negócio?
              </h2>
              <p className="text-xl text-orange-50 mb-10">
                Junte-se a centenas de empresas que já usam NexoGestão
              </p>
              <Button
                onClick={() => navigate("/register")}
                className="bg-white text-orange-600 hover:bg-gray-100 px-10 py-4 text-lg font-bold shadow-xl hover:shadow-2xl"
              >
                Começar Grátis Agora
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-slate-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center text-gray-600 dark:text-gray-400">
          <p>© 2026 NexoGestão. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
