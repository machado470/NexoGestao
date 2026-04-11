import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button } from "@/components/design-system";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NexoStatusBadge,
  NexoStatCard,
  DataTable,
} from "@/components/design-system";
import { MoreHorizontal } from "lucide-react";

export function AppPageShell({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn("nexo-page-shell min-w-0 space-y-4", className)}
      {...props}
    />
  );
}

export function AppPageHeader({
  className,
  ...props
}: ComponentProps<"header">) {
  return (
    <header
      className={cn("nexo-page-header nexo-section-reveal", className)}
      {...props}
    />
  );
}

export function AppPageSection({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn("nexo-page-section nexo-section-reveal", className)}
      {...props}
    />
  );
}

export function AppToolbar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "nexo-card-informative flex flex-wrap items-center justify-between gap-2 rounded-xl p-3",
        className
      )}
      {...props}
    />
  );
}

export const AppFiltersBar = AppToolbar;

export function AppSectionCard({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn("nexo-card-panel p-4 md:p-5", className)}
      {...props}
    />
  );
}

export function AppStatCard({
  className,
  ...props
}: ComponentProps<typeof NexoStatCard>) {
  return <NexoStatCard className={cn("h-full", className)} {...props} />;
}

export function AppInfoCard({
  className,
  ...props
}: ComponentProps<"article">) {
  return (
    <article
      className={cn("nexo-card-informative p-4", className)}
      {...props}
    />
  );
}

export function AppEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="nexo-card-informative flex flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-base font-semibold text-[var(--text-primary)]">
        {title}
      </p>
      <p className="max-w-xl text-sm text-[var(--text-muted)]">{description}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </section>
  );
}

export const AppDataTable = DataTable;
export const AppStatusBadge = NexoStatusBadge;

export function AppRowActionsDropdown({
  triggerLabel = "Ações",
  items,
}: {
  triggerLabel?: string;
  items: Array<{ label: string; onSelect: () => void; disabled?: boolean }>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={triggerLabel}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map(item => (
          <DropdownMenuItem
            key={item.label}
            disabled={item.disabled}
            onSelect={item.onSelect}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppPagination({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2", className)}
      {...props}
    />
  );
}

export function AppForm({ className, ...props }: ComponentProps<"form">) {
  return <form className={cn("space-y-4", className)} {...props} />;
}

export function AppFormSection({
  title,
  subtitle,
  className,
  children,
}: {
  title?: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {title ? (
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          {title}
        </h3>
      ) : null}
      {subtitle ? (
        <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
      ) : null}
      {children}
    </section>
  );
}

export function AppField({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <AppInlineHint>{hint}</AppInlineHint> : null}
    </div>
  );
}

export function AppFieldGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)} {...props} />
  );
}

export const AppTextarea = Textarea;
export const AppCheckbox = Checkbox;
export const AppRadio = RadioGroup;

export function AppSelect({
  value,
  onValueChange,
  placeholder,
  options,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AppInput(props: ComponentProps<typeof Input>) {
  return <Input {...props} />;
}

export function AppInlineHint({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-xs text-[var(--text-muted)]", className)}
      {...props}
    />
  );
}

export function AppFormActions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 pt-1",
        className
      )}
      {...props}
    />
  );
}

export const AppDropdown = DropdownMenu;
export const AppPopover = DropdownMenu;

const toastTone = cva("rounded-xl border p-3", {
  variants: {
    tone: {
      info: "border-[var(--border)] bg-[var(--surface-elevated)]",
      success:
        "border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[color-mix(in_srgb,var(--success)_10%,var(--surface-elevated))]",
      warning:
        "border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_10%,var(--surface-elevated))]",
      danger:
        "border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface-elevated))]",
    },
  },
  defaultVariants: { tone: "info" },
});

export function AppToast({
  className,
  tone,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof toastTone>) {
  return <div className={cn(toastTone({ tone }), className)} {...props} />;
}

export function AppAlert({
  className,
  ...props
}: ComponentProps<typeof Alert>) {
  return (
    <Alert className={cn("border-[var(--border)]", className)} {...props} />
  );
}
export { AlertTitle as AppAlertTitle, AlertDescription as AppAlertDescription };

export function AppLoadingState({
  label = "Carregando...",
}: {
  label?: string;
}) {
  return (
    <div className="nexo-card-informative p-4 text-sm text-[var(--text-muted)]">
      {label}
    </div>
  );
}

export function AppSkeleton({
  className,
  ...props
}: ComponentProps<typeof Skeleton>) {
  return <Skeleton className={cn("h-4 w-full", className)} {...props} />;
}

export function AppSuccessState({ message }: { message: string }) {
  return (
    <AppToast tone="success">
      <p className="text-sm text-[var(--text-primary)]">{message}</p>
    </AppToast>
  );
}

export function AppErrorState({ message }: { message: string }) {
  return (
    <AppToast tone="danger">
      <p className="text-sm text-[var(--text-primary)]">{message}</p>
    </AppToast>
  );
}

export function AppTimeline({ className, ...props }: ComponentProps<"ol">) {
  return <ol className={cn("space-y-3", className)} {...props} />;
}

export function AppTimelineItem({ className, ...props }: ComponentProps<"li">) {
  return <li className={cn("nexo-card-timeline p-3", className)} {...props} />;
}

export const AppActivityFeed = AppTimeline;

export const AppTabs = Tabs;
export const AppTabsList = TabsList;
export const AppTabsTrigger = TabsTrigger;
export const AppTabsContent = TabsContent;

export {
  Breadcrumb as AppBreadcrumbs,
  BreadcrumbItem as AppBreadcrumbItem,
  BreadcrumbLink as AppBreadcrumbLink,
  BreadcrumbList as AppBreadcrumbList,
  BreadcrumbPage as AppBreadcrumbPage,
  BreadcrumbSeparator as AppBreadcrumbSeparator,
  RadioGroupItem as AppRadioItem,
};
