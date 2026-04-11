import { Button } from "@/components/ui/button";

type RowAction = {
  label: string;
  onClick: () => void;
  isLoading?: boolean;
};

export function AppRowActions({ actions }: { actions: RowAction[] }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {actions.map(action => (
        <Button key={action.label} type="button" size="sm" variant="outline" onClick={action.onClick} isLoading={action.isLoading} className="max-w-full">
          <span className="nexo-truncate" title={action.label}>{action.label}</span>
        </Button>
      ))}
    </div>
  );
}
