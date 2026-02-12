import { useTheme } from '../theme/useTheme'

export default function ToggleThemeButton() {
  const { theme, toggleTheme } = useTheme()

  // ✅ Tema claro = offwhite
  const isLight = theme === 'offwhite'

  return (
    <button
      onClick={toggleTheme}
      aria-label="Alternar tema"
      className="
        p-2 rounded-md
        text-slate-400 hover:text-white
        hover:bg-white/5
        transition-colors
      "
    >
      {isLight ? (
        // Moon icon (modo escuro)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
        </svg>
      ) : (
        // Sun icon (modo claro)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
        </svg>
      )}
    </button>
  )
}
