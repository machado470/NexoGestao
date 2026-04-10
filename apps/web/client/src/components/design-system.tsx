import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("nexo-app-shell", className)}>{children}</div>;
}

export function SidebarNav({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <aside className={cn("nexo-sidebar", className)}>{children}</aside>;
}

export function Topbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <header className={cn("nexo-topbar", className)}>{children}</header>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="nexo-page-header nexo-section-reveal">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="nexo-page-header-title">{title}</div>
          {subtitle ? (
            <p className="nexo-page-header-description">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function SurfaceCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("nexo-surface p-5", className)}>{children}</section>
  );
}

export function StatCard({
  label,
  value,
  helper,
  className,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("nexo-card-kpi p-4", className)}>
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
        {value}
      </p>
      {helper ? (
        <p className="mt-1 text-xs text-[var(--text-muted)]">{helper}</p>
      ) : null}
    </article>
  );
}

export function DataTable({ className, ...props }: ComponentProps<"table">) {
  return (
    <table className={cn("w-full nexo-data-table", className)} {...props} />
  );
}

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--bg-surface)_82%,transparent)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]",
        className
      )}
    >
      {children}
    </span>
  );
}

export function TimelineList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-2", className)}>{children}</div>;
}

export function PriorityList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-2", className)}>{children}</div>;
}

export function AlertCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("nexo-card-alert", className)}>{children}</div>;
}

export function SearchInput(props: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-xl border border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--bg-surface)_78%,transparent)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/35",
        props.className
      )}
    />
  );
}

export const Input = SearchInput;

export function Select(props: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "h-10 w-full rounded-xl border border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--bg-surface)_78%,transparent)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/35",
        props.className
      )}
    />
  );
}

export function PrimaryButton({
  className,
  ...props
}: ComponentProps<"button">) {
  return <button {...props} className={cn("nexo-cta-primary", className)} />;
}

export function SecondaryButton({
  className,
  ...props
}: ComponentProps<"button">) {
  return <button {...props} className={cn("nexo-cta-secondary", className)} />;
}

export function GhostButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-10 items-center rounded-xl px-3 text-sm text-[var(--text-secondary)] transition hover:bg-[color-mix(in_srgb,var(--bg-surface-hover)_65%,transparent)] hover:text-[var(--text-primary)]",
        className
      )}
    />
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <SurfaceCard className="text-center">
      <p className="text-sm font-semibold text-[var(--text-primary)]">
        {title}
      </p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
    </SurfaceCard>
  );
}

export function LoadingState({ message }: { message: string }) {
  return (
    <SurfaceCard className="text-sm text-[var(--text-secondary)]">
      {message}
    </SurfaceCard>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <SurfaceCard className="border-[color-mix(in_srgb,var(--danger)_45%,transparent)] text-sm text-[color-mix(in_srgb,var(--danger)_75%,white)]">
      {message}
    </SurfaceCard>
  );
}
