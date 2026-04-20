import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button, SecondaryButton } from "@/components/design-system";

type ModalAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type SummaryItem = {
  label: string;
  value: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  status?: string;
  priority?: string;
  summary?: SummaryItem[];
  headerActions?: ReactNode;
  primaryAction?: ModalAction;
  secondaryAction?: ModalAction;
  quickActions?: ModalAction[];
  feedback?: ReactNode;
  children: ReactNode;
};

export function AppOperationalModal({
  open,
  onOpenChange,
  title,
  subtitle,
  status,
  priority,
  summary = [],
  headerActions,
  primaryAction,
  secondaryAction,
  quickActions = [],
  feedback,
  children,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[92vh] w-[min(96vw,1280px)] max-w-none flex-col gap-0 overflow-hidden border-[var(--border-subtle)] bg-[var(--surface-base)] p-0"
        onOpenAutoFocus={event => {
          event.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--surface-base)] px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-[var(--text-primary)]">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {subtitle}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {status ? (
                  <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    {status}
                  </span>
                ) : null}
                {priority ? (
                  <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    {priority}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {headerActions}
              <SecondaryButton
                type="button"
                className="h-9 px-3"
                onClick={() => onOpenChange(false)}
              >
                <X className="mr-1 h-4 w-4" /> Fechar
              </SecondaryButton>
            </div>
          </div>
          {summary.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              {summary.map(item => (
                <div
                  key={item.label}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2"
                >
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        <footer className="sticky bottom-0 z-20 border-t border-[var(--border-subtle)] bg-[var(--surface-base)] px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {primaryAction ? (
                <Button
                  type="button"
                  onClick={primaryAction.onClick}
                  disabled={primaryAction.disabled}
                  className="h-9 px-4"
                >
                  {primaryAction.label}
                </Button>
              ) : null}
              {secondaryAction ? (
                <SecondaryButton
                  type="button"
                  onClick={secondaryAction.onClick}
                  disabled={secondaryAction.disabled}
                  className="h-9 px-4"
                >
                  {secondaryAction.label}
                </SecondaryButton>
              ) : null}
              {quickActions.map(action => (
                <SecondaryButton
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className="h-9 px-3 text-xs"
                >
                  {action.label}
                </SecondaryButton>
              ))}
            </div>
            {feedback ? (
              <div className="text-xs text-[var(--text-secondary)]">{feedback}</div>
            ) : null}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
