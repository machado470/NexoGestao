import { useRef } from "react";

export function useRenderWatchdog(name: string) {
  const ref = useRef(0);
  ref.current++;
  if (ref.current > 50) {
    throw new Error(`RENDER LOOP DETECTADO: ${name}`);
  }
}
