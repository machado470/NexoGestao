import type { ReactNode } from "react";
import { Bot, Sparkles, User, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PrimaryActionButton } from "@/components/operating-system/PrimaryActionButton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ContextPanelAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type ContextPanelTimelineItem = {
  id: string;
  label: string;
  description?: string;
  source?: "system" | "user";
};

type ContextPanelExplainLayer = {
  reason: string;
  conditions: string[];
  afterAction: string;
};

type ContextPanelWhatsAppPreview = {
  contextLabel: string;
  contextDescription: string;
  message: string;
  editable?: boolean;
  onMessageChange?: (value: string) => void;
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
  explainLayer,
  whatsAppPreview,
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
  explainLayer?: ContextPanelExplainLayer;
  whatsAppPreview?: ContextPanelWhatsAppPreview;
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
              {statusLabel ? <p className="mt-2 inline-flex rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">Status: {statusLabel}</p> : null}
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
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                Próxima ação prioritária
              </p>
              <PrimaryActionButton
                className="w-full"
                label={primaryAction.label}
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
              />
            </div>
          ) : null}

          {explainLayer ? (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/60 dark:bg-blue-950/30">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                <Sparkles className="h-3.5 w-3.5" />
                Explain layer
              </p>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">{explainLayer.reason}</p>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700/80 dark:text-blue-300/90">
                  Condições detectadas
                </p>
                <ul className="mt-1 space-y-1">
                  {explainLayer.conditions.map(condition => (
                    <li key={condition} className="text-xs text-blue-900/90 dark:text-blue-100/90">
                      • {condition}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <span className="font-semibold">Depois:</span> {explainLayer.afterAction}
              </p>
            </div>
          ) : null}

          {whatsAppPreview ? (
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                WhatsApp no fluxo operacional
              </p>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                {whatsAppPreview.contextLabel}
              </p>
              <p className="text-xs text-emerald-800/90 dark:text-emerald-200/90">
                {whatsAppPreview.contextDescription}
              </p>
              {whatsAppPreview.editable ? (
                <Textarea
                  rows={4}
                  value={whatsAppPreview.message}
                  onChange={event =>
                    whatsAppPreview.onMessageChange?.(event.target.value)
                  }
                  className="text-xs"
                />
              ) : (
                <div className="rounded-md border border-emerald-200 bg-white/80 p-2 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
                  {whatsAppPreview.message}
                </div>
              )}
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
                <div key={item.id} className="rounded-md border bg-muted/30 p-2">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {item.source ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                          item.source === "system"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                            : "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200"
                        )}
                      >
                        {item.source === "system" ? <Bot className="mr-1 h-3 w-3" /> : <User className="mr-1 h-3 w-3" />}
                        {item.source === "system" ? "Sistema" : "Usuário"}
                      </span>
                    ) : null}
                    {item.label}
                  </p>
                  {item.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
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
