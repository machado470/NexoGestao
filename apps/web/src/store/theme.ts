import { create } from "zustand";

export const useThemeStore = create((set) => ({
  theme: "light",
  toggle: () =>
    set((s: any) => ({ theme: s.theme === "light" ? "dark" : "light" })),
}));
