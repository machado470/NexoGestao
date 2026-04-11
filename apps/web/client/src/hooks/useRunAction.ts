import { useCallback, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function useRunAction() {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const runAction = useCallback(
    async <T,>(action: () => Promise<T>, messages?: { loading?: string; success?: string; error?: string }) => {
      setIsRunning(true);
      setError(null);

      try {
        const result = await action();
        toast.success(messages?.success ?? "Ação executada com sucesso.");
        await utils.invalidate();
        return { ok: true as const, result };
      } catch (actionError) {
        const message = actionError instanceof Error ? actionError.message : messages?.error ?? "Erro ao executar ação.";
        setError(message);
        toast.error(message);
        return { ok: false as const, error: message };
      } finally {
        setIsRunning(false);
      }
    },
    [utils]
  );

  return {
    runAction,
    isRunning,
    error,
  };
}
