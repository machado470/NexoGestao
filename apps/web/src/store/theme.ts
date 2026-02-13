import { create } from 'zustand'

type ThemeMode = 'light' | 'dark'

type ThemeState = {
  theme: ThemeMode
  toggle: () => void
}

export const useThemeStore = create<ThemeState>(set => ({
  theme: 'light',
  toggle: () =>
    set(s => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
}))
