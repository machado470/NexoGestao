import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../../components/base/Card'

export default function Hero() {
  const [kpi, setKpi] = useState({
    risks: 0,
    compliance: 0,
    actions: 0,
  })

  useEffect(() => {
    const t = setTimeout(() => {
      setKpi({ risks: 8, compliance: 54, actions: 12 })
    }, 250)
    return () => clearTimeout(t)
  }, [])

  return (
    <section className="relative overflow-hidden">
      {/* FUNDO — CAMADAS CONTROLADAS */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950 via-slate-950 to-black" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.22),transparent_45%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_60%,rgba(37,99,235,0.18),transparent_50%)]" />

      {/* CONTAINER */}
      <div className="relative max-w-7xl mx-auto px-6 min-h-[90vh] flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 w-full items-center">
          {/* TEXTO */}
          <div>
            <span className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 text-xs tracking-wider uppercase rounded-full border border-blue-400/20 text-blue-300 bg-blue-500/5">
              Governança jurídica operacional
            </span>

            <h1 className="text-4xl md:text-5xl xl:text-6xl font-semibold text-white leading-tight">
              Decisões jurídicas
              <br />
              <span className="text-blue-400">
                sustentadas por dados reais
              </span>
            </h1>

            <p className="mt-8 text-lg text-slate-300 max-w-xl">
              Treinamento, risco humano e auditoria em um sistema
              único, rastreável e defensável — do primeiro acesso à
              ação corretiva.
            </p>

            <ul className="mt-10 space-y-4 text-sm text-slate-300">
              <li className="flex gap-3">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-400" />
                Backend autoritativo, sem decisão manual
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-400" />
                Risco recalculado a cada execução
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-400" />
                Histórico defensável e auditável
              </li>
            </ul>

            <div className="mt-14 flex flex-col sm:flex-row gap-4">
              <a
                href="#how"
                className="
                  px-8 py-4 rounded-xl
                  bg-blue-600 text-white font-medium
                  hover:bg-blue-500
                  transition-all duration-200
                  shadow-lg shadow-blue-600/20
                "
              >
                Ver como funciona
              </a>

              <Link
                to="/login"
                className="
                  px-8 py-4 rounded-xl
                  border border-white/20 text-white
                  hover:bg-white/5
                  transition-all duration-200
                "
              >
                Entrar no sistema
              </Link>
            </div>

            <p className="mt-6 text-xs text-slate-400">
              * Painel ilustrativo baseado no modelo real do sistema
            </p>
          </div>

          {/* CARD EXECUTIVO */}
          <div className="relative">
            <Card
              className="
                p-10 space-y-8
                backdrop-blur
                bg-slate-900/70
                border border-white/10
                shadow-2xl shadow-black/40
                transition-transform duration-300
                hover:-translate-y-1
              "
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider">
                  Visão executiva
                </h3>
                <span className="text-xs text-blue-400">
                  Tempo real
                </span>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1">
                  <div className="text-3xl font-semibold text-white">
                    {kpi.risks}
                  </div>
                  <div className="text-xs text-slate-400">
                    Riscos ativos
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-3xl font-semibold text-blue-400">
                    {kpi.compliance}%
                  </div>
                  <div className="text-xs text-slate-400">
                    Conformidade
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-3xl font-semibold text-white">
                    {kpi.actions}
                  </div>
                  <div className="text-xs text-slate-400">
                    Ações pendentes
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <svg
                  viewBox="0 0 400 160"
                  className="w-full h-32"
                >
                  <defs>
                    <linearGradient
                      id="line"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
                      <stop
                        offset="0%"
                        stopColor="rgba(59,130,246,0.3)"
                      />
                      <stop
                        offset="100%"
                        stopColor="rgba(59,130,246,1)"
                      />
                    </linearGradient>
                  </defs>

                  <polyline
                    fill="none"
                    stroke="url(#line)"
                    strokeWidth="3"
                    points="0,110 60,100 120,85 180,92 240,70 300,55 360,45"
                  />
                </svg>
              </div>
            </Card>

            {/* GLOW CONTROLADO */}
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-blue-500/10 blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  )
}
