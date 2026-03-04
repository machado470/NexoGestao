import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Zap, Star, Crown, ArrowRight } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { StripeCheckout } from "@/components/StripeCheckout";
import { AdsColumn } from "@/components/AdsColumn";


interface Plan {
  id: string;
  name: string;
  price: number;
  billingPeriod: "month" | "year";
  description: string;
  icon: React.ReactNode;
  features: string[];
  highlighted: boolean;
  cta: string;
}

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    billingPeriod: "month",
    description: "Perfeito para pequenos negócios",
    icon: <Zap className="w-8 h-8 text-blue-500" />,
    features: [
      "Até 100 clientes",
      "Agendamentos básicos",
      "Relatórios simples",
      "Suporte por email",
      "1 usuário",
      "Backup automático",
    ],
    highlighted: false,
    cta: "Começar",
  },
  {
    id: "professional",
    name: "Professional",
    price: 79,
    billingPeriod: "month",
    description: "Para empresas em crescimento",
    icon: <Star className="w-8 h-8 text-orange-500" />,
    features: [
      "Clientes ilimitados",
      "Agendamentos avançados",
      "Relatórios detalhados",
      "Suporte prioritário",
      "Até 5 usuários",
      "Backup automático",
      "Integração WhatsApp",
      "API access",
    ],
    highlighted: true,
    cta: "Escolher Plano",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 199,
    billingPeriod: "month",
    description: "Para grandes operações",
    icon: <Crown className="w-8 h-8 text-purple-500" />,
    features: [
      "Clientes ilimitados",
      "Agendamentos avançados",
      "Relatórios customizáveis",
      "Suporte 24/7 dedicado",
      "Usuários ilimitados",
      "Backup automático",
      "Integração WhatsApp",
      "API access",
      "Webhooks customizados",
      "Consultoria estratégica",
    ],
    highlighted: false,
    cta: "Contatar Vendas",
  },
];

export default function Premium() {
  const { isAuthenticated } = useAuth();
  const [billingPeriod, setBillingPeriod] = useState<"month" | "year">("month");

  const getPrice = (plan: Plan) => {
    if (billingPeriod === "year") {
      return Math.floor(plan.price * 12 * 0.8); // 20% desconto anual
    }
    return plan.price;
  };

  const handleSelectPlan = (planId: string) => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    // Aqui você pode implementar a lógica de checkout
    console.log(`Selecionado plano: ${planId}`);
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="flex-1">
      {/* Header */}
      <div className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
            Planos Premium
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Escolha o plano perfeito para sua empresa e desbloqueie todo o potencial do NexoGestão
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <button
              onClick={() => setBillingPeriod("month")}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                billingPeriod === "month"
                  ? "bg-orange-500 text-white"
                  : "bg-slate-700 text-gray-300 hover:bg-slate-600"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBillingPeriod("year")}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                billingPeriod === "year"
                  ? "bg-orange-500 text-white"
                  : "bg-slate-700 text-gray-300 hover:bg-slate-600"
              }`}
            >
              Anual (20% OFF)
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
                plan.highlighted
                  ? "md:scale-105 ring-2 ring-orange-500 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl"
                  : "bg-slate-800 hover:bg-slate-700"
              }`}
            >
              {/* Badge para plano destacado */}
              {plan.highlighted && (
                <div className="absolute top-0 right-0 bg-orange-500 text-white px-4 py-1 rounded-bl-lg text-sm font-semibold">
                  Mais Popular
                </div>
              )}

              <div className="p-8">
                {/* Icon */}
                <div className="mb-4">{plan.icon}</div>

                {/* Plan Name */}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-gray-400 text-sm mb-6">{plan.description}</p>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">R$ {getPrice(plan)}</span>
                    <span className="text-gray-400">/{billingPeriod === "month" ? "mês" : "ano"}</span>
                  </div>
                  {billingPeriod === "year" && (
                    <p className="text-green-400 text-sm mt-2">
                      Economize R$ {Math.floor(plan.price * 12 * 0.2)}/ano
                    </p>
                  )}
                </div>

                {/* CTA Button */}
                {isAuthenticated && plan.id !== "enterprise" ? (
                  <StripeCheckout
                    planId={plan.id as "starter" | "professional" | "enterprise"}
                    billingCycle={billingPeriod === "month" ? "monthly" : "annual"}
                    planName={plan.name}
                    price={getPrice(plan)}
                  />
                ) : (
                  <Button
                    onClick={() => handleSelectPlan(plan.id)}
                    className={`w-full mb-8 gap-2 ${
                      plan.highlighted
                        ? "bg-orange-500 hover:bg-orange-600 text-white"
                        : "bg-slate-700 hover:bg-slate-600 text-white"
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}

                {/* Features */}
                <div className="space-y-4">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Perguntas Frequentes</h2>

        <div className="space-y-6">
          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              Posso mudar de plano a qualquer momento?
            </h3>
            <p className="text-gray-400">
              Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. As mudanças entram em vigor no próximo ciclo de faturamento.
            </p>
          </div>

          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              Há período de teste gratuito?
            </h3>
            <p className="text-gray-400">
              Sim! Todos os planos incluem 14 dias de teste gratuito. Nenhum cartão de crédito necessário.
            </p>
          </div>

          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              Qual é a política de cancelamento?
            </h3>
            <p className="text-gray-400">
              Você pode cancelar sua assinatura a qualquer momento. Não há taxas de cancelamento, mas você perderá acesso aos recursos premium imediatamente.
            </p>
          </div>

          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              Vocês oferecem desconto para pagamento anual?
            </h3>
            <p className="text-gray-400">
              Sim! Oferecemos 20% de desconto para assinaturas anuais. Você economiza significativamente escolhendo pagar anualmente.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto para começar?</h2>
          <p className="text-lg mb-8 text-orange-100">
            Escolha seu plano e comece a gerenciar seu negócio com NexoGestão
          </p>
          <Button
            onClick={() => handleSelectPlan("professional")}
            className="bg-white text-orange-600 hover:bg-gray-100 font-semibold px-8 py-3 rounded-lg gap-2"
          >
            Começar Teste Gratuito
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      </div>

      {/* Ads Column Sidebar */}
      <AdsColumn />
    </div>
  );
}
