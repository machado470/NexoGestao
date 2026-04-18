import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppCardCTA({
  label = "Abrir",
  onClick,
}: {
  label?: string;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onClick}
      className="h-7 max-w-full rounded-full px-2.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--dashboard-row-hover)] hover:text-[var(--text-primary)]"
    >
      <span className="truncate">{label}</span>
      <ChevronRight className="h-4 w-4" />
    </Button>
  );
}
