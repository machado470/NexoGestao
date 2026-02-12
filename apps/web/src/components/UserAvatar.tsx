import { useTheme } from '../theme/useTheme'

type Props = {
  name: string
  size?: number
}

export default function UserAvatar({
  name,
  size = 40,
}: Props) {
  const { styles } = useTheme()

  const initials = name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      className={`
        flex items-center justify-center
        rounded-full
        font-semibold
        ${styles.surface}
        ${styles.border}
      `}
      style={{
        width: size,
        height: size,
      }}
    >
      {initials}
    </div>
  )
}
