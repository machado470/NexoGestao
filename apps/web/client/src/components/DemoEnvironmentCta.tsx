import { useLocation } from "wouter";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoEnvironment } from "@/hooks/useDemoEnvironment";

type Props = {
  className?: string;
};

export function DemoEnvironmentCta({ className }: Props) {
  const [, navigate] = useLocation();
  const { isGenerating, generateDemoEnvironment } = useDemoEnvironment();

  async function handleGenerate() {
    const result = await generateDemoEnvironment();
    if (result?.customerId) {
      navigate(`/timeline?customerId=${result.customerId}`);
    }
  }

  return (
    <div
      className={`rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/40 dark:bg-orange-950/20 ${className ?? ""}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">
            Ambiente vivo para demo
          </p>
          <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">
            Gera cliente → agendamento → O.S. concluída → cobrança → pagamento,
            com atualização imediata de timeline, risco, governança e WhatsApp.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => void handleGenerate()}
          disabled={isGenerating}
          className="gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Gerar ambiente de demonstração
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
