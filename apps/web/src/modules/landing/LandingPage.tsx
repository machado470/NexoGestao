import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import LayoutBase from '../../components/layout/LayoutBase'
import Hero from './Hero'
import Features from './Features'
import CTA from './CTA'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useAuth } from '../../auth/AuthContext'
import { useMe } from '../../hooks/useMe'

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { me, loading: meLoading } = useMe()

  useEffect(() => {
    if (authLoading || meLoading) return
    if (!isAuthenticated || !me) return

    if (me.role === 'ADMIN') {
      navigate('/admin', { replace: true })
      return
    }

    navigate('/collaborator', { replace: true })
  }, [authLoading, meLoading, isAuthenticated, me, navigate])

  if (authLoading || meLoading) {
    return null
  }

  if (isAuthenticated) {
    // enquanto redireciona
    return null
  }

  return (
    <ThemeProvider forceTheme="blue">
      <LayoutBase>
        <Hero />
        <Features />
        <CTA />
      </LayoutBase>
    </ThemeProvider>
  )
}
