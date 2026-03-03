import { useLocation } from "wouter";
import { ArrowRight, CheckCircle, Users, BarChart3, Shield, Zap, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 font-poppins">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl font-bold tracking-tight">
              <span className="text-orange-500">Nexo</span>
              <span className="text-gray-900 dark:text-white">Gestão</span>
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/login")}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Entrar
            </button>
            <Button
              onClick={() => navigate("/register")}
              className="bg-orange-500 hover:bg-orange-600 text-white transition-all transform hover:scale-105"
            >
              Começar Grátis
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background SVG */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-5">
          <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 L100,0 L100,100 L0,100 Z" fill="#F97316"></path>
            <path d="M0,0 C30,20 70,20 100,0 L100,100 L0,100 Z" fill="#F97316" opacity="0.5"></path>
          </svg>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="animate-slideInLeft">
              <div className="inline-block bg-orange-500 text-white px-4 py-2 rounded-full text-sm mb-6 font-medium">
                Sistema Administrativo
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold mb-6 relative">
                <span className="relative inline-block">
                  <span className="text-orange-500">Nexo</span>
                  <span className="absolute inset-0 text-orange-500 opacity-0 blur-md animate-pulse" style={{animationDuration: '3s'}}>Nexo</span>
                </span>
                <span className="text-gray-900 dark:text-white">Gestão</span>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                Centralize clientes, agendamentos, ordens de serviço e finanças em uma única plataforma. Com governança inteligente e análise de risco em tempo real.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate("/register")}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 text-lg font-medium rounded-lg flex items-center justify-center transition-all transform hover:scale-105 hover:shadow-lg"
                >
                  Conhecer agora <ArrowRight className="ml-2 w-5 h-5" />
                </button>
                <button
                  onClick={() => navigate("/login")}
                  className="border-2 border-orange-500 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 px-8 py-3 text-lg font-medium rounded-lg transition-all"
                >
                  Ver demonstração
                </button>
              </div>
            </div>

            {/* Right Content - Dashboard Preview */}
            <div className="relative hidden lg:block animate-slideInRight" style={{animationDelay: '0.2s'}}>
              <div className="relative">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                  {/* Browser Header */}
                  <div className="bg-gray-100 dark:bg-gray-700 p-3 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 ml-2 font-medium">NexoGestão - Dashboard</div>
                  </div>

                  {/* Dashboard Content */}
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Dashboard</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Visão geral do sistema</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        </div>
                        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          N
                        </div>
                      </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Vendas</div>
                        <div className="font-bold text-lg text-gray-900 dark:text-white">R$ 12.580</div>
                        <div className="text-xs text-green-500 font-medium">+12% ↑</div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <div className="text-xs text-green-600 dark:text-green-400 font-medium">Clientes</div>
                        <div className="font-bold text-lg text-gray-900 dark:text-white">248</div>
                        <div className="text-xs text-green-500 font-medium">+5% ↑</div>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                        <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">Produtos</div>
                        <div className="font-bold text-lg text-gray-900 dark:text-white">1.240</div>
                        <div className="text-xs text-orange-500 font-medium">+2% ↑</div>
                      </div>
                    </div>

                    {/* Chart */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 h-32 rounded-lg mb-4 flex items-center justify-center">
                      <svg className="w-full h-full p-4" viewBox="0 0 200 100" preserveAspectRatio="none">
                        <path d="M0,50 C20,30 40,70 60,50 C80,30 100,60 120,50 C140,40 160,80 180,50 L180,100 L0,100 Z" fill="rgba(249, 115, 22, 0.2)"></path>
                        <path d="M0,50 C20,30 40,70 60,50 C80,30 100,60 120,50 C140,40 160,80 180,50" fill="none" stroke="#F97316" strokeWidth="2"></path>
                      </svg>
                    </div>

                    {/* Menu Icons */}
                    <div className="flex gap-2">
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg flex-1 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">Vendas</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg flex-1 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">Clientes</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg flex-1 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">Estoque</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg flex-1 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">Relatórios</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating Badge */}
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white transform rotate-12 shadow-lg hover:shadow-xl transition-shadow">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Tudo que você precisa para gerenciar seu negócio
            </h2>
            <div className="w-24 h-1 bg-orange-500 mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature Cards */}
            {[
              {
                icon: Users,
                title: "Gestão de Clientes",
                description: "Centralize todas as informações de clientes, histórico de interações e preferências em um único lugar.",
                color: "blue"
              },
              {
                icon: BarChart3,
                title: "Análise de Dados",
                description: "Visualize métricas importantes em tempo real com dashboards intuitivos e relatórios detalhados.",
                color: "green"
              },
              {
                icon: Shield,
                title: "Governança Inteligente",
                description: "Análise de risco automática e conformidade com regulamentações de forma simplificada.",
                color: "purple"
              },
              {
                icon: Zap,
                title: "Automação",
                description: "Automatize processos repetitivos e economize tempo em tarefas administrativas.",
                color: "yellow"
              },
              {
                icon: MessageSquare,
                title: "Comunicação",
                description: "Integração com WhatsApp e email para manter contato direto com seus clientes.",
                color: "red"
              },
              {
                icon: CheckCircle,
                title: "Conformidade",
                description: "Emissão de NF-e, controle fiscal e documentação automática de todas as operações.",
                color: "green"
              }
            ].map((feature, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 border-l-4 border-orange-500 hover:shadow-lg transition-all transform hover:-translate-y-2 animate-slideInUp"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-${feature.color}-50 dark:bg-${feature.color}-900/20`}>
                  <feature.icon className={`w-6 h-6 text-${feature.color}-500`} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-orange-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Pronto para transformar sua gestão?
          </h2>
          <p className="text-xl text-orange-100 mb-8">
            Comece gratuitamente e descubra como o NexoGestão pode revolucionar sua empresa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate("/register")}
              className="bg-white text-orange-500 hover:bg-gray-100 px-8 py-3 rounded-lg font-bold transition-all transform hover:scale-105"
            >
              Começar Agora
            </button>
            <button
              onClick={() => navigate("/login")}
              className="border-2 border-white text-white hover:bg-white/10 px-8 py-3 rounded-lg font-bold transition-all"
            >
              Já tenho conta
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-10 w-10 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold">
                  N
                </div>
                <span className="text-white font-bold">NexoGestão</span>
              </div>
              <p className="text-sm">Sistema administrativo completo para sua empresa.</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Recursos</a></li>
                <li><a href="#" className="hover:text-white transition">Preços</a></li>
                <li><a href="#" className="hover:text-white transition">Segurança</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Sobre</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Contato</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Privacidade</a></li>
                <li><a href="#" className="hover:text-white transition">Termos</a></li>
                <li><a href="#" className="hover:text-white transition">Cookies</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2026 NexoGestão. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
