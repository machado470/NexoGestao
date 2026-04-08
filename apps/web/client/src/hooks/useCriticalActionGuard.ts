import { useEffect, useMemo, useRef } from "react";
import { useCriticalActionStore } from "@/stores/criticalActionStore";

type Options = {
  isPending: boolean;
  reason: string;
  blockNavigation?: boolean;
};

export function useCriticalActionGuard({
  isPending,
  reason,
  blockNavigation = true,
}: Options) {
  const tokenRef = useRef(`critical-${Math.random().toString(36).slice(2)}`);
  const start = useCriticalActionStore((state) => state.start);
  const finish = useCriticalActionStore((state) => state.finish);

  useEffect(() => {
    if (isPending) {
      start(tokenRef.current, reason);
      return;
    }

    finish(tokenRef.current);
  }, [finish, isPending, reason, start]);

  useEffect(() => {
    if (!isPending || !blockNavigation) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = reason;
    };

    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [blockNavigation, isPending, reason]);

  useEffect(() => {
    return () => {
      finish(tokenRef.current);
    };
  }, [finish]);

  return useMemo(
    () => ({
      isLocked: isPending,
      reason,
    }),
    [isPending, reason]
  );
}
