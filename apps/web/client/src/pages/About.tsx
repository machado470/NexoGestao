import { useLocation } from "wouter";
import { ArrowLeft, Heart, Users, Zap, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function About() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="bg-orange-500 text-white py-8">
        <div className="container mx-auto px-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <h1 className="text-4xl font-bold mb-2">Sobre o NexoGestão</h1>
          <p className="text-orange-100 text-lg">
            Plataforma completa de gestão para empresas de serviços
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Mission Section */}
        <section className="mb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Nossa Missão
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                O NexoGestão foi desenvolvido para simplificar a gestão de empresas de serviços,
                oferecendo uma plataforma integrada que conecta clientes, agendamentos, ordens de
                serviço, financeiro e equipe em um único lugar.
              </p>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Acreditamos que a tecnologia deve ser acessível, intuitiva e poderosa o suficiente
                para transformar a forma como você trabalha.
              </p>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-8 text-white">
              <Target className="w-16 h-16 mb-4" />
              <h3 className="text-2xl font-bold mb-2">Visão</h3>
              <p>
                Ser a plataforma de gestão mais confiável e fácil de usar para empresas de
                serviços em toda a América Latina.
              </p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            O Que Oferecemos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Users,
                title: "Gestão de Clientes",
                description: "Mantenha todos os dados dos seus clientes organizados e acessíveis",
              },
              {
                icon: Zap,
                title: "Agendamentos",
                description: "Sistema inteligente de agendamentos com notificações automáticas",
              },
              {
                icon: Target,
                title: "Ordens de Serviço",
                description: "Controle total sobre suas ordens de serviço e prioridades",
              },
              {
                icon: Heart,
                title: "Financeiro",
                description: "Gestão completa de cobranças, receitas e relatórios financeiros",
              },
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 hover:shadow-lg transition-shadow"
                >
                  <Icon className="w-8 h-8 text-orange-500 mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Values Section */}
        <section className="mb-16 bg-gray-50 dark:bg-gray-800 rounded-lg p-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Nossos Valores
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Simplicidade",
                description:
                  "Interfaces intuitivas que qualquer pessoa pode usar sem treinamento complexo",
              },
              {
                title: "Confiabilidade",
                description: "Seus dados estão seguros com criptografia de ponta a ponta",
              },
              {
                title: "Inovação",
                description: "Constantemente atualizando com novas funcionalidades e melhorias",
              },
            ].map((value, index) => (
              <div key={index} className="text-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {value.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">{value.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Pronto para começar?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Junte-se a centenas de empresas que já estão usando o NexoGestão para gerenciar
            seus negócios de forma mais eficiente.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate("/register")}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Criar Conta Grátis
            </Button>
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="border-orange-500 text-orange-500 hover:bg-orange-50 dark:hover:bg-gray-800"
            >
              Voltar ao Início
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">
            © 2026 NexoGestão. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
