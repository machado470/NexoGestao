import { createContext, useContext, useState } from 'react'

export type Density = 'compact' | 'comfortable' | 'expanded'

const DensityContext = createContext<{
  density: Density
  setDensity: (d: Density) => void
} | null>(null)

export function DensityProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [density, setDensity] = useState<Density>('comfortable')

  return (
    <DensityContext.Provider value={{ density, setDensity }}>
      {children}
    </DensityContext.Provider>
  )
}

export function useDensity() {
  const ctx = useContext(DensityContext)
  if (!ctx) {
    throw new Error('useDensity must be used inside DensityProvider')
  }
  return ctx
}
