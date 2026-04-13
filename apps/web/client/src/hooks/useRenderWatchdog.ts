import { useEffect, useRef } from "react";

export function useRenderWatchdog(componentName: string, maxRenders = 45, windowMs = 3000) {
  const metaRef = useRef({ startedAt: Date.now(), count: 0 });
  metaRef.current.count += 1;

  useEffect(() => {
    const now = Date.now();
    if (now - metaRef.current.startedAt > windowMs) {
      metaRef.current = { startedAt: now, count: 1 };
      return;
    }

    if (metaRef.current.count > maxRenders) {
      // eslint-disable-next-line no-console
      console.warn("[RENDER LOOP] suspicious_render_rate", {
        component: componentName,
        count: metaRef.current.count,
        windowMs,
      });
    }
  });
}
