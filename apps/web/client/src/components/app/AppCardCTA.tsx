import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppCardCTA({ label = "Abrir", onClick }: { label?: string; onClick?: () => void }) {
  return (
    <Button type="button" size="sm" variant="ghost" onClick={onClick} className="max-w-full">
      <span className="truncate">{label}</span>
      <ChevronRight className="h-4 w-4" />
    </Button>
  );
}
