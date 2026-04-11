import { Button } from "@/components/ui/button";

type RowAction = {
  label: string;
  onClick: () => void;
  isLoading?: boolean;
};

export function AppRowActions({ actions }: { actions: RowAction[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map(action => (
        <Button key={action.label} type="button" size="sm" variant="outline" onClick={action.onClick} isLoading={action.isLoading}>
          {action.label}
        </Button>
      ))}
    </div>
  );
}
