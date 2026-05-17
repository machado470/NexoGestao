import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium text-[var(--modal-section-text)] select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-100 peer-disabled:cursor-not-allowed peer-disabled:text-[var(--field-disabled-text)] peer-disabled:opacity-100",
        className
      )}
      {...props}
    />
  );
}

export { Label };
