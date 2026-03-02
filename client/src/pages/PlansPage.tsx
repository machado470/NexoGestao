import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function PlansPage() {
  const { user } = useAuth();
  const [selectedBilling, setSelectedBilling] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [upgrading, setUpgrading] = useState<number | null>(null);

  const { data: plans, isLoading: plansLoading } = trpc.plans.listAll.useQuery();
  const { data: currentSubscription } = trpc.plans.getCurrentSubscription.useQuery();
  const { data: referralStats } = trpc.referrals.getStats.useQuery({ page: 1, limit: 100 });
  const upgradeMutation = trpc.plans.upgrade.useMutation({
    onSuccess: () => {
      toast.success("Plano atualizado com sucesso!");
      setUpgrading(null);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar plano: " + error.message);
      setUpgrading(null);
    },
  });

  const handleUpgrade = (planId: number) => {
    setUpgrading(planId);
    upgradeMutation.mutate({
      planId,
      billingCycle: selectedBilling,
      useReferralCredits: referralStats?.availableCredits || 0,
    });
  };

  if (plansLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Escolha seu Plano
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Comece gratuitamente e escale conforme sua empresa cresce
          </p>

          {/* Billing Toggle */}
          <div className="flex justify-center items-center gap-4 mb-8">
            <span
              className={`text-sm font-medium ${
                selectedBilling === "monthly"
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-500"
              }`}
            >
              Mensal
            </span>
            <button
              onClick={() =>
                setSelectedBilling(
                  selectedBilling === "monthly" ? "yearly" : "monthly"
                )
              }
              className="relative inline-flex h-8 w-14 items-center rounded-full bg-gray-300 dark:bg-gray-600"
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                  selectedBilling === "yearly" ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
            <span
              className={`text-sm font-medium ${
                selectedBilling === "yearly"
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-500"
              }`}
            >
              Anual
              <span className="ml-2 inline-block bg-orange-500 text-white text-xs px-2 py-1 rounded">
                -20%
              </span>
            </span>
          </div>

          {/* Referral Credits Info */}
          {referralStats?.availableCredits && referralStats.availableCredits > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-8 max-w-md mx-auto">
              <p className="text-sm text-green-800 dark:text-green-300">
                💚 Você tem <strong>R$ {referralStats.availableCredits.toFixed(2)}</strong> em créditos de referência para usar!
              </p>
            </div>
          )}
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans?.map((plan) => {
            const isCurrentPlan =
              currentSubscription?.planId === plan.id;
            const price =
              selectedBilling === "yearly"
                ? Number(plan.priceYearly || plan.priceMonthly)
                : Number(plan.priceMonthly);
            const features = Array.isArray(plan.features)
              ? plan.features
              : JSON.parse(plan.features || "[]");

            return (
              <div
                key={plan.id}
                className={`rounded-lg shadow-lg overflow-hidden transition transform hover:scale-105 ${
                  isCurrentPlan
                    ? "ring-2 ring-orange-500 bg-white dark:bg-gray-800"
                    : "bg-white dark:bg-gray-800"
                }`}
              >
                {/* Plan Header */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
                  <h2 className="text-2xl font-bold mb-2">{plan.displayName}</h2>
                  <p className="text-sm opacity-90">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  {price > 0 ? (
                    <div className="text-center">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        R$ {price.toFixed(2)}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 ml-2">
                        /{selectedBilling === "yearly" ? "ano" : "mês"}
                      </span>
                    </div>
                  ) : (
                    <div className="text-center">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        Grátis
                      </span>
                    </div>
                  )}
                </div>

                {/* Limits */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Clientes
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {plan.maxClients === -1 ? "Ilimitado" : plan.maxClients}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Agendamentos
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {plan.maxAppointments === -1
                          ? "Ilimitado"
                          : plan.maxAppointments}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Ordens de Serviço
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {plan.maxServiceOrders === -1
                          ? "Ilimitado"
                          : plan.maxServiceOrders}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Cobranças
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {plan.maxCharges === -1 ? "Ilimitado" : plan.maxCharges}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Colaboradores
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {plan.maxPeople === -1 ? "Ilimitado" : plan.maxPeople}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    Recursos
                  </h3>
                  <div className="space-y-3">
                    {[
                      "whatsapp",
                      "invoices",
                      "reports",
                      "api",
                      "sso",
                    ].map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        {features.includes(feature) ? (
                          <Check className="w-5 h-5 text-green-500" />
                        ) : (
                          <X className="w-5 h-5 text-gray-300" />
                        )}
                        <span
                          className={
                            features.includes(feature)
                              ? "text-gray-900 dark:text-white"
                              : "text-gray-400 line-through"
                          }
                        >
                          {feature === "whatsapp" && "WhatsApp Integration"}
                          {feature === "invoices" && "Notas Fiscais"}
                          {feature === "reports" && "Relatórios Avançados"}
                          {feature === "api" && "API Access"}
                          {feature === "sso" && "SSO"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <div className="p-6">
                  {isCurrentPlan ? (
                    <Button disabled className="w-full">
                      Plano Atual
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={upgrading === plan.id}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {upgrading === plan.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Atualizando...
                        </>
                      ) : (
                        "Escolher Plano"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Perguntas Frequentes
          </h2>
          <div className="space-y-4">
            <details className="bg-white dark:bg-gray-800 rounded-lg p-6 cursor-pointer">
              <summary className="font-semibold text-gray-900 dark:text-white">
                Posso mudar de plano a qualquer momento?
              </summary>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Sim! Você pode fazer upgrade ou downgrade a qualquer momento. As mudanças entram em efeito imediatamente.
              </p>
            </details>

            <details className="bg-white dark:bg-gray-800 rounded-lg p-6 cursor-pointer">
              <summary className="font-semibold text-gray-900 dark:text-white">
                Como funcionam os créditos de referência?
              </summary>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Cada pessoa que você refere e faz upgrade gera créditos que você pode usar para pagar planos ou receber como cashback.
              </p>
            </details>

            <details className="bg-white dark:bg-gray-800 rounded-lg p-6 cursor-pointer">
              <summary className="font-semibold text-gray-900 dark:text-white">
                Há contrato de longo prazo?
              </summary>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Não! Você pode cancelar sua assinatura a qualquer momento sem penalidades.
              </p>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
