import { Button } from "@/components/ui/button";

export function AppEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="nexo-card-informative flex flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-base font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="max-w-xl text-sm text-[var(--text-muted)]">{description}</p>
      {actionLabel && onAction ? (
        <Button type="button" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </section>
  );
}
