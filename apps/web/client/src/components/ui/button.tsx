import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-sm font-semibold nexo-state-transition disabled:pointer-events-none disabled:opacity-45 disabled:saturate-70 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none active:scale-[var(--motion-press-scale)]",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)]",
        default:
          "bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)]",
        danger:
          "bg-destructive text-destructive-foreground hover:bg-[color-mix(in_srgb,var(--destructive)_86%,black)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-[color-mix(in_srgb,var(--destructive)_86%,black)]",
        neutral:
          "border border-white/20 bg-transparent text-white hover:border-white/35 hover:bg-white/10",
        outline:
          "border border-white/20 bg-transparent text-white hover:border-white/35 hover:bg-white/10",
        secondary:
          "border border-white/20 bg-transparent text-white hover:border-white/35 hover:bg-white/10",
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
      variant: "primary",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  isLoading = false,
  loadingLabel = "Carregando...",
  children,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    isLoading?: boolean;
    loadingLabel?: string;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
