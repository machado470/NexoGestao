import { useEffect, useState } from "react";
import { useSearchParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (!sessionId) {
      setError("Session ID não encontrado");
      navigate("/premium");
      setLoading(false);
      return;
    }

    // Simular processamento de pagamento
    setTimeout(() => {
      setSuccess(true);
      setLoading(false);
    }, 1500);
  }, [sessionId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-white text-lg">Processando seu pagamento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">✕</div>
          <h1 className="text-3xl font-bold text-white mb-2">Erro no Pagamento</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <Button
            onClick={() => navigate("/premium")}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Voltar aos Planos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-white mb-2">Pagamento Confirmado!</h1>
        <p className="text-gray-300 mb-2">
          Obrigado por escolher o NexoGestão Premium.
        </p>
        <p className="text-gray-400 mb-8">
          Sua assinatura está ativa e você já tem acesso a todos os recursos premium.
        </p>

        <div className="bg-slate-800 rounded-lg p-6 mb-8 text-left">
          <h2 className="text-lg font-semibold text-white mb-4">Próximos Passos:</h2>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start gap-3">
              <span className="text-orange-500 font-bold">1.</span>
              <span>Acesse o dashboard para começar a usar todos os recursos</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-orange-500 font-bold">2.</span>
              <span>Consulte a documentação para aprender as melhores práticas</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-orange-500 font-bold">3.</span>
              <span>Entre em contato com nosso suporte se tiver dúvidas</span>
            </li>
          </ul>
        </div>

        <div className="flex gap-4">
          <Button
            onClick={() => navigate("/")}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
          >
            Ir para Dashboard
          </Button>
          <Button
            onClick={() => navigate("/settings")}
            variant="outline"
            className="flex-1"
          >
            Gerenciar Assinatura
          </Button>
        </div>
      </div>
    </div>
  );
}
