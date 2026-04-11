import { useRunAction } from "@/hooks/useRunAction";
import { Button } from "@/components/ui/button";

type NextActionItem = {
  id: string;
  title: string;
  impact: string;
  run: () => Promise<unknown>;
};

export function AppNextActions({ items }: { items: NextActionItem[] }) {
  const { runAction, isRunning } = useRunAction();

  return (
    <section className="nexo-card-panel p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Próximas ações críticas</h3>
      <div className="mt-3 space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] p-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
              <p className="text-xs text-[var(--text-muted)]">{item.impact}</p>
            </div>
            <Button type="button" size="sm" onClick={() => void runAction(item.run)} isLoading={isRunning}>
              Executar
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
