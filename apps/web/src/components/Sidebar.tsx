import { NavLink } from 'react-router-dom'
import { useTheme } from '../theme/useTheme'

type Item = {
  label: string
  to: string
}

export default function Sidebar({ items = [] }: { items?: Item[] }) {
  const { styles } = useTheme()

  return (
    <aside className={`rounded border ${styles.cardBorder} ${styles.cardBg} p-3`}>
      <nav className="space-y-1">
        {items.map(i => (
          <NavLink
            key={i.to}
            to={i.to}
            className={({ isActive }) =>
              [
                'block text-sm px-3 py-2 rounded',
                isActive ? styles.buttonPrimary : 'opacity-80 hover:opacity-100',
              ].join(' ')
            }
          >
            {i.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
