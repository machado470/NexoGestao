import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'nexogestao_theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    return saved || 'system';
  });

  const [isDark, setIsDark] = useState(false);

  // Update DOM and state when theme changes
  useEffect(() => {
    let effectiveTheme = theme;

    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    const isDarkMode = effectiveTheme === 'dark';
    setIsDark(isDarkMode);

    // Update HTML element
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Save preference
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setIsDark(mediaQuery.matches);
      if (mediaQuery.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  const setThemeMode = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return {
    theme,
    isDark,
    toggleTheme,
    setTheme: setThemeMode,
  };
}
