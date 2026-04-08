import { Loader2, ShieldAlert } from "lucide-react";
import { useCriticalActionStore } from "@/stores/criticalActionStore";

export function CriticalActionOverlay() {
  const activeToken = useCriticalActionStore((state) => state.activeToken);
  const reason = useCriticalActionStore((state) => state.reason);

  if (!activeToken) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
      <div className="rounded-xl border border-orange-300 bg-white p-4 text-center shadow-xl dark:border-orange-900/50 dark:bg-zinc-900">
        <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Ação crítica em andamento
        </p>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
          {reason || "Aguarde para evitar inconsistências de dados."}
        </p>
        <p className="mt-3 inline-flex items-center gap-2 text-xs text-orange-600 dark:text-orange-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Bloqueando interações temporariamente
        </p>
      </div>
    </div>
  );
}
