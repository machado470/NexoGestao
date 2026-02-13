import { createContext } from 'react'

export type Density = 'compact' | 'comfortable' | 'expanded'

export const DensityContext = createContext<{
  density: Density
  setDensity: (d: Density) => void
} | null>(null)
