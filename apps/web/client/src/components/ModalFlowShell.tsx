import { useEffect, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/design-system";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer: ReactNode;
  isSubmitting?: boolean;
  closeBlocked?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  loadingTimeoutMs?: number;
  hasDirtyState?: boolean;
};

export default function ModalFlowShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  isSubmitting = false,
  closeBlocked = false,
  isLoading = false,
  hasError = false,
  errorMessage,
  onRetry,
  loadingTimeoutMs = 9000,
  hasDirtyState = false,
}: Props) {
  useEffect(() => {
    if (!open || !isSubmitting) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "Uma ação crítica está em andamento.";
    };

    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isSubmitting, open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && (closeBlocked || isSubmitting)) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (closeBlocked || isSubmitting) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (closeBlocked || isSubmitting) event.preventDefault();
        }}
        className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0 shadow-sm"
      >
        <DialogHeader className="border-b border-[var(--border-subtle)] px-6 py-5">
          <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-sm text-[var(--text-secondary)]">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="nexo-modal-body min-h-0 flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-zinc-800 dark:bg-[var(--surface-base)]/60 dark:text-gray-300">
              <p className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                Carregando dados do fluxo...
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Se ultrapassar {Math.ceil(loadingTimeoutMs / 1000)}s, use retry para evitar estado morto.
              </p>
              {onRetry ? (
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  Tentar novamente
                </Button>
              ) : null}
            </div>
          ) : hasError ? (
            <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
              <p className="inline-flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {errorMessage || "Não foi possível carregar este fluxo."}
              </p>
              {onRetry ? (
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  Tentar novamente
                </Button>
              ) : null}
            </div>
          ) : (
            children
          )}
        </div>

        <DialogFooter className="border-t border-[var(--border-subtle)] px-6 py-4">
          {footer}
        </DialogFooter>
        {hasDirtyState ? (
          <div className="border-t border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            Alterações não salvas detectadas.
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
