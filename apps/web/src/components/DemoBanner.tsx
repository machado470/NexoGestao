import useOrganization from '../hooks/useOrganization'

export default function DemoBanner() {
  const { get } = useOrganization()
  const org = get()

  if (!org) return null

  return (
    <div className="p-3 bg-blue-600 text-white text-sm text-center">
      Modo demonstração — {org.name}
    </div>
  )
}
