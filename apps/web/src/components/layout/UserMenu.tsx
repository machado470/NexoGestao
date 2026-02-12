import { useMe } from '../../hooks/useMe'
import { useTheme } from '../../theme/useTheme'

export default function UserMenu() {
  const { me, loading } = useMe()
  const { styles } = useTheme()

  return (
    <div
      className={`rounded-md p-3 text-sm ${styles.surface} ${styles.border}`}
    >
      <div className="font-medium">
        {loading ? '—' : me?.email ?? 'Usuário'}
      </div>
      <div className="text-xs opacity-60">
        {me?.role ?? '—'}
      </div>
    </div>
  )
}
