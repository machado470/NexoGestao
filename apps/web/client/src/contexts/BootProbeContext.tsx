import { createContext, useContext, type ReactNode } from "react";

export type BootProbeStage =
  | "full"
  | "router"
  | "auth"
  | "layout"
  | "execution-bar"
  | "global-engine"
  | "static";

type BootProbeContextValue = {
  stage: BootProbeStage;
};

const BootProbeContext = createContext<BootProbeContextValue>({ stage: "full" });

export function BootProbeProvider({
  stage,
  children,
}: {
  stage: BootProbeStage;
  children: ReactNode;
}) {
  return (
    <BootProbeContext.Provider value={{ stage }}>
      {children}
    </BootProbeContext.Provider>
  );
}

export function useBootProbe() {
  return useContext(BootProbeContext);
}
