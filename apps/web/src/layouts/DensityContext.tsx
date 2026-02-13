import type { ReactNode } from 'react'
import { useState } from 'react'
import { DensityContext, type Density } from './densityContext'

export function DensityProvider({
  children,
}: {
  children: ReactNode
}) {
  const [density, setDensity] = useState<Density>('comfortable')

  return (
    <DensityContext.Provider value={{ density, setDensity }}>
      {children}
    </DensityContext.Provider>
  )
}
