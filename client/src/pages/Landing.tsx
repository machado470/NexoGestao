import { useLocation } from "wouter";
import { ArrowRight, CheckCircle, Users, BarChart3, Shield, Zap, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-10 w-10 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-xl">
              N
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">NexoGestão</span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/login")}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Entrar
            </button>
            <Button
              onClick={() => navigate("/register")}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Começar Grátis
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
                Gestão Operacional Inteligente
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                Centralize clientes, agendamentos, ordens de serviço e finanças em uma única plataforma. Com governança inteligente e análise de risco em tempo real.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => navigate("/register")}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 text-lg flex items-center justify-center"
                >
                  Começar Grátis <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-300 dark:border-gray-700 px-8 py-3 text-lg"
                >
                  Ver Demo
                </Button>
              </div>
            </div>
            <div className="relative">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663394229933/UkSfjbuHhmYYA3CiX3bLPT/nexo-hero-bg-fatRHdQdgUmaG3QY9UtpEm.webp"
                alt="Hero"
                className="rounded-lg shadow-2xl"
              />
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
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Funcionalidades completas para operações modernas
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 border-l-4 border-orange-500">
              <Users className="w-12 h-12 text-orange-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Gestão de Clientes
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Centralize todas as informações de clientes, histórico de interações e preferências em um único lugar.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 border-l-4 border-blue-500">
              <BarChart3 className="w-12 h-12 text-blue-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Agendamentos & Ordens
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Calendário integrado com agendamentos automáticos e rastreamento de ordens de serviço em tempo real.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 border-l-4 border-green-500">
              <Shield className="w-12 h-12 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Governança & Risco
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Monitore risco operacional, crie trilhas de aprendizado e mantenha conformidade automaticamente.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 border-l-4 border-purple-500">
              <Zap className="w-12 h-12 text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Financeiro Completo
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Gerencie cobranças, pagamentos e relatórios financeiros com visibilidade total do fluxo de caixa.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 border-l-4 border-red-500">
              <MessageSquare className="w-12 h-12 text-red-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Comunicação Integrada
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Notificações automáticas via WhatsApp, email e SMS para manter todos informados.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 border-l-4 border-indigo-500">
              <CheckCircle className="w-12 h-12 text-indigo-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Relatórios Executivos
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Dashboards inteligentes com métricas em tempo real e insights para tomada de decisão.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Planos Simples e Transparentes
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Escolha o plano ideal para seu negócio
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Starter */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 border border-gray-200 dark:border-gray-800">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Starter</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">Para pequenos negócios</p>
              <div className="text-4xl font-bold text-orange-500 mb-6">
                R$ 99<span className="text-lg text-gray-600 dark:text-gray-300">/mês</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center text-gray-600 dark:text-gray-300">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  Até 100 clientes
                </li>
                <li className="flex items-center text-gray-600 dark:text-gray-300">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  Agendamentos ilimitados
                </li>
                <li className="flex items-center text-gray-600 dark:text-gray-300">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  Gestão financeira básica
                </li>
                <li className="flex items-center text-gray-600 dark:text-gray-300">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  Suporte por email
                </li>
              </ul>
              <Button
                onClick={() => navigate("/register")}
                variant="outline"
                className="w-full border-orange-500 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10"
              >
                Começar Grátis
              </Button>
            </div>

            {/* Professional */}
            <div className="bg-orange-500 rounded-lg shadow p-8 border-2 border-orange-500 relative">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <span className="bg-orange-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Popular
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Professional</h3>
              <p className="text-orange-100 mb-6">Para empresas em crescimento</p>
              <div className="text-4xl font-bold text-white mb-6">
                R$ 299<span className="text-lg text-orange-100">/mês</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center text-white">
                  <CheckCircle className="w-5 h-5 text-orange-100 mr-3" />
                  Até 1.000 clientes
                </li>
                <li className="flex items-center text-white">
                  <CheckCircle className="w-5 h-5 text-orange-100 mr-3" />
                  Agendamentos ilimitados
                </li>
                <li className="flex items-center text-white">
                  <CheckCircle className="w-5 h-5 text-orange-100 mr-3" />
                  Gestão financeira completa
                </li>
                <li className="flex items-center text-white">
                  <CheckCircle className="w-5 h-5 text-orange-100 mr-3" />
                  Governança e risco
                </li>
                <li className="flex items-center text-white">
                  <CheckCircle className="w-5 h-5 text-orange-100 mr-3" />
                  Suporte prioritário
                </li>
              </ul>
              <Button
                onClick={() => navigate("/register")}
                className="w-full bg-white text-orange-500 hover:bg-gray-100"
              >
                Começar Grátis
              </Button>
            </div>

            {/* Enterprise */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 border border-gray-200 dark:border-gray-800">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Enterprise</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">Para grandes organizações</p>
              <div className="text-4xl font-bold text-orange-500 mb-6">
                Customizado
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center text-gray-600 dark:text-gray-300">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  Clientes ilimitados
                </li>
                <li className="flex items-center text-gray-600 dark:text-gray-300">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  Todas as features
                </li>
                <li className="flex items-center text-gray-600 dark:text-gray-300">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  API customizada
                </li>
                <li className="flex items-center text-gray-600 dark:text-gray-300">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  Suporte 24/7
                </li>
              </ul>
              <Button
                variant="outline"
                className="w-full border-gray-300 dark:border-gray-700"
              >
                Contato Comercial
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-orange-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Pronto para transformar sua gestão operacional?
          </h2>
          <p className="text-xl text-orange-100 mb-8">
            Comece grátis hoje. Sem cartão de crédito necessário.
          </p>
          <Button
            onClick={() => navigate("/register")}
            className="bg-white text-orange-500 hover:bg-gray-100 px-8 py-3 text-lg"
          >
            Começar Agora <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold">
                  N
                </div>
                <span className="font-bold text-white">NexoGestão</span>
              </div>
              <p className="text-sm">Gestão operacional inteligente para seu negócio.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Produto</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Sobre</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Contato</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Privacidade</a></li>
                <li><a href="#" className="hover:text-white">Termos</a></li>
                <li><a href="#" className="hover:text-white">Cookies</a></li>
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
