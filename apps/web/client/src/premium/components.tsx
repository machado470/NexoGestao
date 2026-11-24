/**
 * NexoGestão Premium — experimental components (PR 0, preview only).
 * New, isolated building blocks; they do not replace any production component.
 */
import type { ComponentProps, ReactNode } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Info,
  TriangleAlert,
} from "lucide-react";

export type NxTone = "ok" | "info" | "warn" | "bad" | "brand" | "neutral";

export function NxBadge({ tone = "neutral", children }: { tone?: NxTone; children: ReactNode }) {
  return (
    <span className="nx-badge" data-tone={tone}>
      {children}
    </span>
  );
}

export function NxButton({
  variant = "secondary",
  size,
  block,
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm";
  block?: boolean;
}) {
  return (
    <button
      type="button"
      className={["nx-btn", className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
      data-block={block ? "true" : undefined}
      {...props}
    />
  );
}

export function NxCard({
  title,
  icon,
  action,
  children,
  className,
  ...props
}: Omit<ComponentProps<"section">, "title"> & {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={["nx-card", className].filter(Boolean).join(" ")} {...props}>
      {title || action ? (
        <header className="nx-card-head">
          {title ? (
            <h3 className="nx-h2 nx-card-title">
              {icon}
              {title}
            </h3>
          ) : null}
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function NxLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className="nx-link" onClick={onClick}>
      {children}
      <ArrowRight aria-hidden="true" />
    </button>
  );
}

/** KPI card: value plus a real comparison only when one exists (no sparkline without a series). */
export function NxKpiCard({
  label,
  value,
  icon,
  delta,
  action,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  delta?: { direction: "up" | "down"; text: string } | null;
  action?: string;
}) {
  return (
    <section className="nx-card nx-kpi" aria-label={label}>
      <div className="nx-kpi-head">
        <span className="nx-kpi-icon" aria-hidden="true">
          {icon}
        </span>
        <p className="nx-text-2">{label}</p>
      </div>
      <div className="nx-kpi-body">
        <p className="nx-display nx-num nx-kpi-value">{value}</p>
        {delta ? (
          <p className="nx-delta" data-direction={delta.direction}>
            {delta.direction === "up" ? <ArrowUpRight aria-hidden="true" /> : <ArrowDownRight aria-hidden="true" />}
            {delta.text}
          </p>
        ) : null}
        {action ? <NxLink>{action}</NxLink> : null}
      </div>
    </section>
  );
}

export function NxProgressList({
  items,
}: {
  items: Array<{ id: string; label: string; percent: number; tone: NxTone; detail?: string }>;
}) {
  return (
    <ul className="nx-progress-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map(item => (
        <li key={item.id} className="nx-progress-row">
          <span>
            {item.label}
            {item.detail ? <span className="nx-muted"> · {item.detail}</span> : null}
          </span>
          <span
            className="nx-progress-track"
            role="progressbar"
            aria-label={item.label}
            aria-valuenow={item.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="nx-progress-fill" data-tone={item.tone} style={{ width: `${item.percent}%`, display: "block" }} />
          </span>
          <strong className="nx-num">{item.percent}%</strong>
        </li>
      ))}
    </ul>
  );
}

const alertIcon = { ok: CheckCircle2, info: Info, warn: TriangleAlert, bad: AlertCircle } as const;

export function NxAlert({
  tone,
  title,
  children,
}: {
  tone: keyof typeof alertIcon;
  title: string;
  children: ReactNode;
}) {
  const Icon = alertIcon[tone];
  return (
    <div className="nx-alert" data-tone={tone} role={tone === "bad" ? "alert" : "status"}>
      <Icon aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p className="nx-text-2">{children}</p>
      </div>
    </div>
  );
}

export function NxState({
  icon,
  tone,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  tone?: "bad";
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="nx-state">
      <span className="nx-state-icon" data-tone={tone} aria-hidden="true">
        {icon}
      </span>
      <strong>{title}</strong>
      <p className="nx-text-2" style={{ maxWidth: "42ch" }}>
        {description}
      </p>
      {action}
    </div>
  );
}

export function NxField({
  id,
  label,
  hint,
  error,
  children,
  full,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={["nx-field", full ? "nx-full" : ""].join(" ")} data-invalid={error ? "true" : undefined}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p className="nx-field-error" id={`${id}-error`}>
          <AlertCircle aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="nx-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
