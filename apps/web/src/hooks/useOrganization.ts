export type Organization = {
  id: string
  name: string
}

export default function useOrganization() {
  function get(): Organization | null {
    try {
      const raw = localStorage.getItem('org')
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  function set(org: Organization) {
    localStorage.setItem('org', JSON.stringify(org))
  }

  return { get, set }
}
