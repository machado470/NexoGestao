import { Skeleton } from "@/components/ui/skeleton";

export function AppLoadingState({ rows = 3, decorative = false }: { rows?: number; decorative?: boolean }) {
  return (
    <div className="space-y-2" role={decorative ? undefined : "status"} aria-hidden={decorative || undefined}>
      {!decorative ? <span className="sr-only">Carregando dados</span> : null}
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
