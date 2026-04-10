import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-[var(--accent-soft)] bg-[var(--accent-soft)]/60 text-[var(--accent)] dark:border-[var(--accent-soft)] dark:bg-[var(--accent-soft)]/25 dark:text-[var(--accent)] [a&]:hover:bg-[var(--accent-soft)]",
        secondary:
          "border-emerald-300/70 bg-emerald-100/80 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-200 [a&]:hover:bg-emerald-200/90",
        destructive:
          "border-red-200 bg-red-100 text-red-700 [a&]:hover:bg-red-200/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:border-red-500/30 dark:bg-red-500/12 dark:text-red-200",
        outline:
          "border-slate-300 text-slate-700 dark:border-white/20 dark:text-slate-200 [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
