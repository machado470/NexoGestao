import Router from './router'
import { useTheme } from './theme/useTheme'

function ThemeCanvas() {
  const { styles } = useTheme()

  return (
    <div
      className={`
        min-h-screen
        ${styles.bg}
        ${styles.text}
      `}
    >
      <Router />
    </div>
  )
}

export default function App() {
  return <ThemeCanvas />
}
