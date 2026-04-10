import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PrimaryActionButton } from "@/components/operating-system/PrimaryActionButton";

type ContextPanelAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type ContextPanelTimelineItem = {
  id: string;
  label: string;
  description?: string;
};

export function ContextPanel({
  open,
  onOpenChange,
  title,
  subtitle,
  statusLabel,
  summary,
  primaryAction,
  secondaryActions = [],
  timeline = [],
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  statusLabel?: string;
  summary?: Array<{ label: string; value: string }>;
  primaryAction?: ContextPanelAction;
  secondaryActions?: ContextPanelAction[];
  timeline?: ContextPanelTimelineItem[];
  children?: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-left">{title}</SheetTitle>
              {subtitle ? (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
              {statusLabel ? (
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-orange-600">
                  Status: {statusLabel}
                </p>
              ) : null}
            </div>
            <Button size="icon" variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          {summary?.length ? (
            <div className="grid grid-cols-2 gap-2">
              {summary.map(item => (
                <div key={item.label} className="rounded-md border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-medium">{item.value}</p>
                </div>
              ))}
            </div>
          ) : null}

          {primaryAction ? (
            <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 dark:bg-orange-950/20">
              <PrimaryActionButton
                className="w-full"
                label={primaryAction.label}
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
              />
            </div>
          ) : null}

          {secondaryActions.length > 0 ? (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ações rápidas
              </p>
              <div className="flex flex-wrap gap-2">
                {secondaryActions.map(action => (
                  <Button
                    key={action.label}
                    size="sm"
                    variant="outline"
                    onClick={action.onClick}
                    disabled={action.disabled}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {timeline.length > 0 ? (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Timeline resumida
              </p>
              {timeline.map(item => (
                <div key={item.id} className="rounded-md bg-muted/40 p-2">
                  <p className="text-sm font-medium">{item.label}</p>
                  {item.description ? (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
