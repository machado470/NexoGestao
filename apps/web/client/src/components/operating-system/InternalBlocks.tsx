import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";

type NexoMetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
  valueClassName?: string;
};

export function NexoMetricCard({
  label,
  value,
  hint,
  className,
  valueClassName,
}: NexoMetricCardProps) {
  return (
    <div className={`nexo-kpi-card ${className ?? ""}`.trim()}>
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold text-[var(--text-primary)] ${
          valueClassName ?? ""
        }`.trim()}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

type NexoContextBlockProps = {
  text: ReactNode;
  badges?: ReactNode;
  className?: string;
};

export function NexoContextBlock({
  text,
  badges,
  className,
}: NexoContextBlockProps) {
  return (
    <section
      className={`nexo-surface-operational flex flex-col gap-2 ${className ?? ""}`.trim()}
    >
      <p className="nexo-text-wrap text-sm font-medium text-[var(--text-primary)]">
        {text}
      </p>
      {badges ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {badges}
        </div>
      ) : null}
    </section>
  );
}

type NexoEntityRowProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: ReactNode;
};

export function NexoEntityRow({
  title,
  subtitle,
  meta,
  icon,
}: NexoEntityRowProps) {
  return (
    <button
      type="button"
      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/70 p-3 text-left"
    >
      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
        {title}
      </p>
      {subtitle ? (
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{subtitle}</p>
      ) : null}
      <p className="mt-2 flex items-center gap-1 text-xs text-[var(--text-muted)]">
        {icon ?? <MessageCircle className="h-3.5 w-3.5" />}
        {meta ?? "Sem histórico"}
      </p>
    </button>
  );
}

type NexoMessageBubbleProps = {
  children: ReactNode;
  className?: string;
  tone?: "incoming" | "outgoing";
};

export function NexoMessageBubble({
  children,
  className,
  tone = "incoming",
}: NexoMessageBubbleProps) {
  const toneClass =
    tone === "outgoing"
      ? "nexo-message-bubble-outgoing"
      : "nexo-message-bubble-incoming";

  return (
    <div
      className={`nexo-message-bubble ${toneClass} max-w-[85%] rounded-2xl border p-3 text-sm text-[var(--text-primary)] ${className ?? ""}`.trim()}
    >
      {children}
    </div>
  );
}
