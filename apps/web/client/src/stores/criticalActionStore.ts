import { create } from "zustand";

type CriticalActionState = {
  activeToken: string | null;
  reason: string | null;
  startedAt: number | null;
  start: (token: string, reason: string) => void;
  finish: (token: string) => void;
  isBlocked: () => boolean;
};

export const useCriticalActionStore = create<CriticalActionState>((set, get) => ({
  activeToken: null,
  reason: null,
  startedAt: null,
  start: (token, reason) =>
    set({
      activeToken: token,
      reason,
      startedAt: Date.now(),
    }),
  finish: (token) => {
    if (get().activeToken !== token) return;
    set({
      activeToken: null,
      reason: null,
      startedAt: null,
    });
  },
  isBlocked: () => Boolean(get().activeToken),
}));
