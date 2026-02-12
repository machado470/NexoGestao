export type ThemeName = 'blue' | 'offwhite'

type ThemeStyles = {
  // base
  bg: string
  surface: string
  border: string
  text: string
  muted: string
  accent: string
  chart: {
    primary: string
    success: string
    warning: string
    danger: string
  }

  // aliases usados pelo app
  background: string
  textPrimary: string
  textMuted: string
  navHover: string
  navActive: string
  buttonPrimary: string
}

export const themes: Record<ThemeName, ThemeStyles> = {
  blue: {
    bg: `
      bg-gradient-to-br
      from-[#0B1E33]
      via-[#081A2D]
      to-[#050F1C]
    `,
    surface: `
      bg-[#0F2A44]/80
      backdrop-blur-xl
      shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]
    `,
    border: 'border-white/10',
    text: 'text-slate-100',
    muted: 'text-slate-400',
    accent: 'text-blue-400',
    chart: {
      primary: '#38BDF8',
      success: '#4ADE80',
      warning: '#FACC15',
      danger: '#F87171',
    },

    // ✅ aliases
    background: `
      bg-gradient-to-br
      from-[#0B1E33]
      via-[#081A2D]
      to-[#050F1C]
    `,
    textPrimary: 'text-slate-100',
    textMuted: 'text-slate-400',
    navHover: 'bg-white/5',
    navActive: 'bg-white/10',
    buttonPrimary: 'bg-blue-600 text-white hover:bg-blue-500',
  },

  offwhite: {
    bg: `
      bg-gradient-to-br
      from-[#f6f3ec]
      via-[#efeadd]
      to-[#e6dfd2]
    `,
    surface: 'bg-white/95 shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
    border: 'border-black/10',
    text: 'text-slate-900',
    muted: 'text-slate-600',
    accent: 'text-blue-600',
    chart: {
      primary: '#2563EB',
      success: '#16A34A',
      warning: '#D97706',
      danger: '#DC2626',
    },

    // ✅ aliases
    background: `
      bg-gradient-to-br
      from-[#f6f3ec]
      via-[#efeadd]
      to-[#e6dfd2]
    `,
    textPrimary: 'text-slate-900',
    textMuted: 'text-slate-600',
    navHover: 'bg-black/5',
    navActive: 'bg-black/10',
    buttonPrimary: 'bg-blue-600 text-white hover:bg-blue-500',
  },
}
