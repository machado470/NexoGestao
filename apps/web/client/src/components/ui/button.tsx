import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-sm font-semibold nexo-state-transition disabled:pointer-events-none disabled:opacity-45 disabled:saturate-70 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/55 aria-invalid:ring-destructive/35 aria-invalid:border-destructive active:scale-[var(--motion-press-scale)]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_10px_24px_color-mix(in_srgb,var(--primary)_32%,transparent)] hover:-translate-y-[var(--motion-float-y)] hover:bg-[var(--accent-hover)] hover:shadow-[0_14px_28px_color-mix(in_srgb,var(--primary)_34%,transparent)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_10px_24px_color-mix(in_srgb,var(--destructive)_30%,transparent)] hover:-translate-y-[var(--motion-float-y)] hover:bg-[color-mix(in_srgb,var(--destructive)_86%,black)]",
        outline:
          "border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:-translate-y-[var(--motion-float-y)] hover:border-[var(--accent-soft)] hover:bg-[var(--surface-base)]",
        secondary:
          "border border-[var(--border)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:-translate-y-[var(--motion-float-y)] hover:bg-[var(--surface-elevated)]",
        ghost:
          "text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-9 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
