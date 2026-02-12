import {
  createContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { themes, type ThemeName } from './themes'

type ThemeContextType = {
  theme: ThemeName
  setTheme: (t: ThemeName) => void
  toggleTheme: () => void
  styles: (typeof themes)[ThemeName]
}

export const ThemeContext =
  createContext<ThemeContextType | null>(null)

export function ThemeProvider({
  children,
  forceTheme,
}: {
  children: ReactNode
  forceTheme?: ThemeName
}) {
  const [theme, setTheme] = useState<ThemeName>(
    forceTheme ?? 'blue',
  )

  // 🔒 Tema forçado ignora localStorage
  useEffect(() => {
    if (forceTheme) {
      setTheme(forceTheme)
      return
    }

    const saved = localStorage.getItem(
      'theme',
    ) as ThemeName | null

    if (saved && themes[saved]) {
      setTheme(saved)
    }
  }, [forceTheme])

  // 🔒 Só persiste se NÃO for forçado
  useEffect(() => {
    if (!forceTheme) {
      localStorage.setItem('theme', theme)
    }
  }, [theme, forceTheme])

  function toggleTheme() {
    if (forceTheme) return
    setTheme(prev =>
      prev === 'blue' ? 'offwhite' : 'blue',
    )
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        styles: themes[theme],
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
