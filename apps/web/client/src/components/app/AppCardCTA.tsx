import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppCardCTA({ label = "Ver detalhes", onClick }: { label?: string; onClick?: () => void }) {
  return (
    <Button type="button" size="sm" variant="ghost" onClick={onClick}>
      {label}
      <ChevronRight className="h-4 w-4" />
    </Button>
  );
}
