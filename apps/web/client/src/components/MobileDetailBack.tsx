import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
export function MobileDetailBack({
  visible,
  onBack,
  label,
}: {
  visible: boolean;
  onBack: () => void;
  label: string;
}) {
  return visible ? (
    <Button
      type="button"
      variant="ghost"
      className="min-h-11 justify-start px-0 md:hidden"
      onClick={onBack}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  ) : null;
}

export function MobileDetailState({
  visible,
  loading,
  failed,
  onRetry,
}: {
  visible: boolean;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  if (!visible) return null;
  return (
    <div
      className="rounded-xl border border-[var(--border-subtle)] p-4 text-sm md:hidden"
      role={failed ? "alert" : "status"}
    >
      <p>
        {loading
          ? "Carregando o registro..."
          : failed
            ? "Não foi possível carregar este registro."
            : "O registro não está disponível neste recorte. Volte à lista para continuar."}
      </p>
      {!loading ? (
        <Button variant="outline" className="mt-3 min-h-11" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}
