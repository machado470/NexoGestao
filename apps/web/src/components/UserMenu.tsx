import { useTheme } from '../theme/useTheme'
import { useMe } from '../hooks/useMe'

export default function UserMenu() {
  const { styles } = useTheme()
  const { me, loading } = useMe()

  if (loading) {
    return (
      <div
        className={`rounded-md p-3 text-sm ${styles.surface} ${styles.border}`}
      >
        Carregando…
      </div>
    )
  }

  return (
    <div
      className={`
        rounded-md p-3 text-sm
        ${styles.surface}
        ${styles.border}
      `}
    >
      <div className="font-medium">
        {me?.email ?? 'Usuário'}
      </div>
      <div className="text-xs opacity-60">
        {me?.role ?? '—'}
      </div>
    </div>
  )
}
