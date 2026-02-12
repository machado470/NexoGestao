import type { ReactNode } from 'react'

export default function SectionBase({
  children,
}: {
  children: ReactNode
}) {
  return (
    <section className="max-w-7xl mx-auto px-6">
      {children}
    </section>
  )
}
