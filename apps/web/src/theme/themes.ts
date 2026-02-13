export type ThemeName = 'orange' | 'offwhite' | 'blue'

export type ThemeStyles = {
  // legado (muito código usa isso)
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

  // “novo” (alguns layouts usam isso)
  background: string
  textPrimary: string
  textMuted: string
  navHover: string
  navActive: string
  buttonPrimary: string

  // compat (card/panel)
  cardBg: string
  cardBorder: string
}

export const themes: Record<ThemeName, ThemeStyles> = {
  orange: {
    bg: `
      bg-gradient-to-br
      from-[#120A06]
      via-[#0B0A0A]
      to-[#070707]
    `,
    surface: `
      bg-[#14110F]/80
      backdrop-blur-xl
      shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]
    `,
    border: 'border-white/10',
    text: 'text-slate-100',
    muted: 'text-slate-400',
    accent: 'text-[#F97316]',
    chart: {
      primary: '#F97316',
      success: '#4ADE80',
      warning: '#FACC15',
      danger: '#F87171',
    },

    background:
      'bg-gradient-to-br from-[#120A06] via-[#0B0A0A] to-[#070707]',
    textPrimary: 'text-slate-100',
    textMuted: 'text-slate-400',
    navHover: 'bg-white/5',
    navActive: 'bg-white/10',
    buttonPrimary:
      'bg-[#F97316] text-black hover:bg-[#FB923C] disabled:opacity-50',

    cardBg:
      'bg-[#14110F]/80 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
    cardBorder: 'border-white/10',
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
    accent: 'text-[#F97316]',
    chart: {
      primary: '#F97316',
      success: '#16A34A',
      warning: '#D97706',
      danger: '#DC2626',
    },

    background:
      'bg-gradient-to-br from-[#f6f3ec] via-[#efeadd] to-[#e6dfd2]',
    textPrimary: 'text-slate-900',
    textMuted: 'text-slate-600',
    navHover: 'bg-black/5',
    navActive: 'bg-black/10',
    buttonPrimary:
      'bg-[#F97316] text-white hover:bg-[#FB923C] disabled:opacity-50',

    cardBg: 'bg-white/95 shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
    cardBorder: 'border-black/10',
  },

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
    accent: 'text-[#F97316]',
    chart: {
      primary: '#38BDF8',
      success: '#4ADE80',
      warning: '#FACC15',
      danger: '#F87171',
    },

    background:
      'bg-gradient-to-br from-[#0B1E33] via-[#081A2D] to-[#050F1C]',
    textPrimary: 'text-slate-100',
    textMuted: 'text-slate-400',
    navHover: 'bg-white/5',
    navActive: 'bg-white/10',
    buttonPrimary:
      'bg-[#F97316] text-black hover:bg-[#FB923C] disabled:opacity-50',

    cardBg:
      'bg-[#0F2A44]/80 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
    cardBorder: 'border-white/10',
  },
}
