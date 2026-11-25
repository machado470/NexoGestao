import { AppEmptyState as EmptyState } from "@/components/app-system";
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
    <EmptyState
      title={title}
      description={description}
      action={
        actionLabel && onAction ? (
          <Button type="button" className="min-h-11" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null
      }
    />
  );
}
