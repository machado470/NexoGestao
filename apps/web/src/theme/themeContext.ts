import { createContext } from 'react'
import { themes, type ThemeName } from './themes'

export type ThemeContextType = {
  theme: ThemeName
  setTheme: (t: ThemeName) => void
  toggleTheme: () => void
  styles: (typeof themes)[ThemeName]
}

export const ThemeContext = createContext<ThemeContextType | null>(
  null,
)
