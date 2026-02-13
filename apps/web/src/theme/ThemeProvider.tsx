import { useEffect, useState, type ReactNode } from 'react'
import { themes, type ThemeName } from './themes'
import { ThemeContext } from './themeContext'

// ✅ compat: imports antigos fazem "from '../theme/ThemeProvider'"
export { useTheme } from './useTheme'

export function ThemeProvider({
  children,
  forceTheme,
}: {
  children: ReactNode
  forceTheme?: ThemeName
}) {
  const [theme, setTheme] = useState<ThemeName>(forceTheme ?? 'orange')

  useEffect(() => {
    if (forceTheme) {
      setTheme(forceTheme)
      return
    }

    const saved = localStorage.getItem('theme') as ThemeName | null
    if (saved && themes[saved]) {
      setTheme(saved)
      return
    }

    setTheme('orange')
  }, [forceTheme])

  useEffect(() => {
    if (!forceTheme) {
      localStorage.setItem('theme', theme)
    }
  }, [theme, forceTheme])

  function toggleTheme() {
    if (forceTheme) return
    setTheme(prev => (prev === 'offwhite' ? 'orange' : 'offwhite'))
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
