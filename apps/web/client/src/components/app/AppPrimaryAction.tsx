import { Button } from "@/components/ui/button";
import { useRunAction } from "@/hooks/useRunAction";

export function AppPrimaryAction({
  label,
  action,
  loadingLabel,
}: {
  label: string;
  action: () => Promise<unknown>;
  loadingLabel?: string;
}) {
  const { runAction, isRunning } = useRunAction();

  return (
    <Button
      type="button"
      onClick={() => void runAction(action)}
      isLoading={isRunning}
      loadingLabel={loadingLabel ?? "Executando..."}
    >
      {label}
    </Button>
  );
}
