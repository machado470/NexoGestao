import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("nexo-skeleton animate-pulse rounded-[0.7rem]", className)}
      {...props}
    />
  );
}

export { Skeleton };
