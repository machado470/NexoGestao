import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from '../theme/useTheme'

type Props = {
  to: string
  label: string
  icon: LucideIcon
}

export default function SidebarItem({
  to,
  label,
  icon: Icon,
}: Props) {
  const { styles } = useTheme()

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `
        flex items-center gap-3 rounded-md px-3 py-2 text-sm
        transition-colors
        ${styles.text}
        ${
          isActive
            ? `${styles.surface} font-medium`
            : 'opacity-70 hover:opacity-100'
        }
      `
      }
    >
      <Icon size={16} />
      <span>{label}</span>
    </NavLink>
  )
}
