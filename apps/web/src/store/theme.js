import { create } from 'zustand';
export const useThemeStore = create(set => ({
    theme: 'light',
    toggle: () => set(s => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
}));
