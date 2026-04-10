import { cn } from "@/lib/utils";

type BrandSignatureProps = {
  compact?: boolean;
  className?: string;
  subtitle?: string;
};

export function BrandSignature({
  compact = false,
  className,
  subtitle = "Workspace Operacional",
}: BrandSignatureProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="grid h-10 w-10 shrink-0 place-content-center rounded-xl bg-slate-900 shadow-sm ring-1 ring-black/10">
        <div className="grid grid-cols-2 gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-white" />
          <span className="h-2.5 w-2.5 rounded-[3px] bg-orange-500" />
          <span className="h-2.5 w-2.5 rounded-[3px] bg-violet-500" />
          <span className="h-2.5 w-2.5 rounded-[3px] bg-white" />
        </div>
      </div>
      {!compact ? (
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
            NexoGestão
          </p>
          <p className="truncate text-xs text-[var(--text-muted)]">{subtitle}</p>
        </div>
      ) : null}
    </div>
  );
}
