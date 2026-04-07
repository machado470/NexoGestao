import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="space-y-8 p-6">{children}</div>;
}

export function PageHero({
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
    <section className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/90 px-6 py-6 shadow-sm dark:border-white/8 dark:bg-[linear-gradient(135deg,rgba(19,22,30,0.98),rgba(12,14,20,0.96))] dark:shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_24%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.08),transparent_24%)]" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300">
              <Sparkles className="h-3.5 w-3.5" />
              {eyebrow}
            </div>
          ) : null}

          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white md:text-4xl">
            {title}
          </h1>

          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function SurfaceSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`nexo-surface p-5 ${className}`.trim()}>{children}</section>;
}
