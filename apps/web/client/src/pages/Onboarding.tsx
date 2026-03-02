import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader, CheckCircle, AlertCircle } from "lucide-react";

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    personName: "",
    personRole: "",
    personEmail: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreatePerson = async () => {
    setError(null);
    if (!formData.personName || !formData.personRole) {
      setError("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    try {
      setLoading(true);
      await api.createPerson({
        name: formData.personName,
        role: formData.personRole,
        email: formData.personEmail || undefined,
      });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar colaborador");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    setError(null);
    try {
      setLoading(true);
      await api.completeOnboarding();
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao completar onboarding");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-6">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center space-x-2 mb-4">
            <div className="h-10 w-10 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-xl">
              N
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">NexoGestão</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Bem-vindo, {user?.userId}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Vamos configurar sua organização em poucos passos
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex-1">
            <div
              className={`h-2 rounded-full transition-all ${
                step >= 1 ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
              }`}
            />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-2">
              Passo 1: Primeiro Colaborador
            </p>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center mx-2 bg-orange-500 text-white font-bold">
            1
          </div>
          <div className="flex-1">
            <div
              className={`h-2 rounded-full transition-all ${
                step >= 2 ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
              }`}
            />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-2">
              Passo 2: Confirmação
            </p>
          </div>
        </div>

        {/* Step 1: Create Person */}
        {step === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Adicione seu primeiro colaborador
            </h2>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  name="personName"
                  value={formData.personName}
                  onChange={handleChange}
                  placeholder="João Silva"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cargo/Função *
                </label>
                <select
                  name="personRole"
                  value={formData.personRole}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Selecione um cargo</option>
                  <option value="Gerente">Gerente</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Operacional">Operacional</option>
                  <option value="Administrativo">Administrativo</option>
                  <option value="Financeiro">Financeiro</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email (opcional)
                </label>
                <input
                  type="email"
                  name="personEmail"
                  value={formData.personEmail}
                  onChange={handleChange}
                  placeholder="joao@empresa.com"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  💡 <strong>Dica:</strong> Você poderá adicionar mais colaboradores depois no dashboard.
                </p>
              </div>

              <Button
                onClick={handleCreatePerson}
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin mr-2" />
                    Criando...
                  </>
                ) : (
                  "Continuar"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Confirmation */}
        {step === 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 mb-6">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Tudo pronto!
            </h2>

            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
              Seu colaborador foi criado com sucesso. Agora você pode acessar o dashboard completo e começar a gerenciar sua operação.
            </p>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Próximos passos:
              </h3>
              <ul className="space-y-3 text-left">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Adicione clientes e agendamentos
                  </span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Crie ordens de serviço e acompanhe o progresso
                  </span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Configure trilhas de aprendizado e governança
                  </span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Acompanhe métricas e relatórios em tempo real
                  </span>
                </li>
              </ul>
            </div>

            <Button
              onClick={handleCompleteOnboarding}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                  Finalizando...
                </>
              ) : (
                "Ir para Dashboard"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
