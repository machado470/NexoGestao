import type { ComponentProps, ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button as UIButton, buttonVariants } from "@/components/ui/button";
import { sanitizeRootWrapperStyle } from "@/components/LayoutProtectionGuard";

export function AppShell({
  children,
  className,
  style,
  ...props
}: ComponentProps<"div"> & {
  children: ReactNode;
}) {
  return (
    <div
      className={cn("nexo-app-shell", className)}
      style={sanitizeRootWrapperStyle(style)}
      {...props}
    >
      {children}
    </div>
  );
}

export const NexoAppShell = AppShell;

export function SidebarNav({
  children,
  className,
  ...props
}: ComponentProps<"aside"> & {
  children: ReactNode;
}) {
  return (
    <aside className={cn("nexo-sidebar", className)} {...props}>
      {children}
    </aside>
  );
}

export const NexoSidebar = SidebarNav;

export function Topbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <header className={cn("nexo-topbar", className)}>{children}</header>;
}

export const NexoTopbar = Topbar;

export function NexoMainContainer({
  children,
  className,
  ...props
}: ComponentProps<"main"> & {
  children: ReactNode;
}) {
  return (
    <main
      data-scrollbar="nexo"
      className={cn(
        "nexo-app-content nexo-section-reveal mt-1.5 min-h-0 flex-1 overflow-auto px-3 pb-4 md:mt-2 md:px-4 md:pb-5",
        className
      )}
      {...props}
    >
      {children}
    </main>
  );
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
  variant = "primary",
}: {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "inner";
}) {
  const surfaceClass =
    variant === "inner"
      ? "nexo-surface-inner p-4"
      : "nexo-surface-primary p-4 md:p-5";

  return <section className={cn(surfaceClass, className)}>{children}</section>;
}

export function NexoCard({
  children,
  className,
  variant = "panel",
}: {
  children: ReactNode;
  className?: string;
  variant?: "base" | "panel" | "alert" | "timeline" | "priority";
}) {
  const variantMap = {
    base: "nexo-card-base",
    panel: "nexo-card-panel",
    alert: "nexo-card-alert",
    timeline: "nexo-card-timeline",
    priority: "nexo-card-priority",
  } as const;

  return (
    <section className={cn(variantMap[variant], className)}>{children}</section>
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

export function NexoStatCard({
  icon,
  label,
  value,
  helper,
  delta,
  className,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  delta?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("nexo-card-kpi", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="nexo-overline">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            {value}
          </p>
          {helper ? (
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {helper}
            </p>
          ) : null}
        </div>
        {icon ? <div className="nexo-icon-tile">{icon}</div> : null}
      </div>
      {delta ? <div className="mt-3">{delta}</div> : null}
    </article>
  );
}

export function DataTable({ className, ...props }: ComponentProps<"table">) {
  return (
    <table
      className={cn("w-full nexo-data-table text-sm", className)}
      {...props}
    />
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

export function NexoBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "info" | "neutral" | "accent";
  className?: string;
}) {
  return (
    <span className={cn("nexo-badge", `nexo-badge-${tone}`, className)}>
      {children}
    </span>
  );
}

export function NexoStatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: "success" | "warning" | "danger" | "info" | "neutral" | "accent";
  className?: string;
}) {
  return (
    <NexoBadge tone={tone} className={className}>
      {label}
    </NexoBadge>
  );
}

export function NexoSearchInput({
  className,
  ...props
}: ComponentProps<"input">) {
  return (
    <div className={cn("nexo-search-input", className)}>
      <Search className="h-4 w-4 text-[var(--text-muted)]" />
      <input
        {...props}
        className="h-full w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
      />
    </div>
  );
}

export function NexoProgressBar({
  value,
  max = 100,
  className,
}: {
  value: number;
  max?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={cn("nexo-progress-track", className)}>
      <div className="nexo-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function NexoPriorityList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("nexo-priority-list", className)}>{children}</div>;
}

export function NexoTimeline({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("nexo-timeline", className)}>{children}</div>;
}

export function NexoAlertCard({
  children,
  tone = "info",
  className,
}: {
  children: ReactNode;
  tone?: "critical" | "warning" | "info";
  className?: string;
}) {
  return (
    <div className={cn("nexo-alert-card", `nexo-alert-${tone}`, className)}>
      {children}
    </div>
  );
}

export function NexoTable({ className, ...props }: ComponentProps<"table">) {
  return (
    <table className={cn("nexo-data-table nexo-table", className)} {...props} />
  );
}

export function NexoPageHeader({
  overline,
  title,
  subtitle,
  actions,
}: {
  overline?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="nexo-page-header">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {overline ? <p className="nexo-overline mb-2">{overline}</p> : null}
          <h1 className="nexo-page-header-title">{title}</h1>
          {subtitle ? (
            <p className="nexo-page-header-description">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}

export function NexoOperationalHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <NexoPageHeader
      overline={eyebrow}
      title={title}
      subtitle={description}
      actions={actions}
    />
  );
}

export function NexoPageSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <SurfaceCard className={cn("p-4 md:p-5", className)}>
      {children}
    </SurfaceCard>
  );
}

export function NexoActionGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  );
}

export function NexoIconTile({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("nexo-icon-tile", className)}>{children}</div>;
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
        "h-9 w-full rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface-contrast)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/35",
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
        "h-9 w-full rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface-contrast)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/35",
        props.className
      )}
    />
  );
}

export function PrimaryButton({
  className,
  ...props
}: ComponentProps<"button">) {
  return <UIButton {...props} variant="primary" className={className} />;
}

export function SecondaryButton({
  className,
  ...props
}: ComponentProps<"button">) {
  return <UIButton {...props} variant="secondary" className={className} />;
}

export function GhostButton({ className, ...props }: ComponentProps<"button">) {
  return <UIButton {...props} variant="ghost" className={className} />;
}

export function Button({
  className,
  variant = "primary",
  size,
  ...props
}: ComponentProps<typeof UIButton> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "neutral" | "default" | "outline" | "destructive" | "link";
}) {
  const normalizedVariant =
    variant === "default" ? "primary" :
    variant === "destructive" ? "danger" :
    variant;

  return (
    <UIButton {...props} size={size} variant={normalizedVariant} className={className} />
  );
}

export { buttonVariants };

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <SurfaceCard className="text-center py-8">
      <p className="text-sm font-semibold text-[var(--text-primary)]">
        {title}
      </p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
    </SurfaceCard>
  );
}

export function LoadingState({ message }: { message: string }) {
  return (
    <SurfaceCard className="py-6 text-sm text-[var(--text-secondary)]">
      {message}
    </SurfaceCard>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <SurfaceCard className="border-[color-mix(in_srgb,var(--danger)_45%,transparent)] py-6 text-sm text-[color-mix(in_srgb,var(--danger)_75%,white)]">
      {message}
    </SurfaceCard>
  );
}
