import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Check, AlertCircle, Settings, Copy, Eye, EyeOff, Loader } from "lucide-react";

interface IntegrationStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

export default function WhatsAppIntegration() {
  const [steps, setSteps] = useState<IntegrationStep[]>([
    {
      id: 1,
      title: "Criar Conta Business",
      description: "Acesse https://www.whatsapp.com/business e crie sua conta de negócios",
      completed: false,
    },
    {
      id: 2,
      title: "Configurar Webhook",
      description: "Configure o webhook para receber mensagens do WhatsApp",
      completed: false,
    },
    {
      id: 3,
      title: "Adicionar Credenciais",
      description: "Insira suas credenciais de API do WhatsApp Business",
      completed: false,
    },
    {
      id: 4,
      title: "Testar Conexão",
      description: "Teste a conexão para garantir que tudo está funcionando",
      completed: false,
    },
  ]);

  const [apiKey, setApiKey] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "error">("idle");

  const handleStepComplete = (stepId: number) => {
    setSteps(steps.map(step =>
      step.id === stepId ? { ...step, completed: !step.completed } : step
    ));
  };

  const handleConnect = async () => {
    if (!apiKey || !phoneNumberId || !businessAccountId) {
      alert("Por favor, preencha todos os campos");
      return;
    }

    setIsConnecting(true);
    try {
      // Simular conexão com API
      await new Promise(resolve => setTimeout(resolve, 2000));
      setConnectionStatus("connected");
      alert("Conexão estabelecida com sucesso!");
    } catch (error) {
      setConnectionStatus("error");
      alert("Erro ao conectar. Verifique suas credenciais.");
    } finally {
      setIsConnecting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copiado para a área de transferência!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <MessageCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Integração WhatsApp Business
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Conecte sua conta WhatsApp Business ao NexoGestão
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Steps */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Passos de Configuração
              </h2>
              <div className="space-y-3">
                {steps.map((step) => (
                  <button
                    key={step.id}
                    onClick={() => handleStepComplete(step.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      step.completed
                        ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                        : "bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:border-orange-300 dark:hover:border-orange-600"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          step.completed
                            ? "bg-green-500 border-green-500"
                            : "border-gray-300 dark:border-slate-500"
                        }`}
                      >
                        {step.completed && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900 dark:text-white">
                          {step.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Progress */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Progresso</p>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${(steps.filter(s => s.completed).length / steps.length) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {steps.filter(s => s.completed).length} de {steps.length} concluído
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Configuration */}
          <div className="lg:col-span-2">
            {/* Status */}
            <div className="mb-6">
              <div
                className={`p-4 rounded-lg border-l-4 flex items-start gap-3 ${
                  connectionStatus === "connected"
                    ? "bg-green-50 dark:bg-green-900/20 border-green-500"
                    : connectionStatus === "error"
                      ? "bg-red-50 dark:bg-red-900/20 border-red-500"
                      : "bg-blue-50 dark:bg-blue-900/20 border-blue-500"
                }`}
              >
                {connectionStatus === "connected" ? (
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : connectionStatus === "error" ? (
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium text-sm">
                    {connectionStatus === "connected"
                      ? "Conectado com sucesso"
                      : connectionStatus === "error"
                        ? "Erro na conexão"
                        : "Não conectado"}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {connectionStatus === "connected"
                      ? "Sua integração WhatsApp está ativa e funcionando"
                      : connectionStatus === "error"
                        ? "Verifique suas credenciais e tente novamente"
                        : "Configure suas credenciais para conectar"}
                  </p>
                </div>
              </div>
            </div>

            {/* Configuration Form */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Credenciais da API
              </h2>

              <div className="space-y-4">
                {/* API Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    API Key
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Insira sua API Key do WhatsApp Business"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      onClick={() => copyToClipboard(apiKey)}
                      className="px-3 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                      title="Copiar"
                    >
                      <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Encontre em: Configurações do WhatsApp Business &gt; API
                  </p>
                </div>

                {/* Phone Number ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Number ID
                  </label>
                  <input
                    type="text"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    placeholder="Insira seu Phone Number ID"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    ID do número de telefone registrado no WhatsApp Business
                  </p>
                </div>

                {/* Business Account ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Business Account ID
                  </label>
                  <input
                    type="text"
                    value={businessAccountId}
                    onChange={(e) => setBusinessAccountId(e.target.value)}
                    placeholder="Insira seu Business Account ID"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    ID da sua conta de negócios no WhatsApp
                  </p>
                </div>
              </div>

              {/* Connect Button */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting || !apiKey || !phoneNumberId || !businessAccountId}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isConnecting ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-4 h-4" />
                      Conectar WhatsApp
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Webhook Configuration */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Configuração do Webhook
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    URL do Webhook
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value="https://api.nexogestao.com/webhooks/whatsapp"
                      readOnly
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none"
                    />
                    <button
                      onClick={() => copyToClipboard("https://api.nexogestao.com/webhooks/whatsapp")}
                      className="px-3 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                      title="Copiar"
                    >
                      <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Verify Token
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value="nexogestao_webhook_token_2024"
                      readOnly
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none"
                    />
                    <button
                      onClick={() => copyToClipboard("nexogestao_webhook_token_2024")}
                      className="px-3 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                      title="Copiar"
                    >
                      <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span className="font-medium">Dica:</span> Configure estas informações nas configurações do webhook do seu WhatsApp Business. O NexoGestão receberá mensagens e eventos em tempo real.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
