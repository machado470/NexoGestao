import Card from '../../components/base/Card'
import SectionBase from '../../components/layout/SectionBase'

type KPI = {
  label: string
  value: string
  hint: string
}

const kpis: KPI[] = [
  {
    label: 'Risco humano',
    value: 'ALTO',
    hint: 'Baseado em execução, atraso e recorrência',
  },
  {
    label: 'Conformidade',
    value: '54%',
    hint: 'Aderência média às trilhas ativas',
  },
  {
    label: 'Ações pendentes',
    value: '12',
    hint: 'Ações corretivas exigidas pelo sistema',
  },
]

export default function ExecutivePreview() {
  return (
    <section className="relative overflow-hidden">
      {/* FUNDO */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950 via-black to-black" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_70%_30%,rgba(59,130,246,0.14),transparent_45%)]" />

      <SectionBase>
        <div className="max-w-7xl mx-auto px-6 py-32">
          {/* CABEÇALHO */}
          <div className="max-w-3xl mb-24">
            <span className="inline-block mb-4 px-4 py-1.5 text-xs tracking-wider uppercase rounded-full border border-blue-400/20 text-blue-300 bg-blue-500/5">
              Visão executiva
            </span>

            <h2 className="text-3xl md:text-4xl font-semibold text-white leading-tight">
              Decisão orientada por dados.
              <br />
              <span className="text-blue-400">
                Não por sensação.
              </span>
            </h2>

            <p className="mt-6 text-lg text-slate-300">
              O painel executivo consolida risco humano, conformidade e
              ações corretivas em um único lugar — com base em dados
              operacionais reais.
            </p>
          </div>

          {/* GRID */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* KPI */}
            {kpis.map(k => (
              <Card
                key={k.label}
                className="
                  relative p-10
                  bg-slate-900/70
                  backdrop-blur
                  border border-white/10
                  transition-all duration-300
                  hover:-translate-y-1
                  hover:shadow-2xl hover:shadow-black/40
                "
              >
                <div className="text-xs uppercase tracking-wider text-slate-400">
                  {k.label}
                </div>

                <div className="mt-4 text-3xl font-semibold text-white">
                  {k.value}
                </div>

                <div className="mt-3 text-sm text-slate-300">
                  {k.hint}
                </div>

                <div className="absolute inset-0 pointer-events-none rounded-2xl bg-blue-500/5 opacity-0 hover:opacity-100 transition" />
              </Card>
            ))}
          </div>

          {/* TENDÊNCIA */}
          <div className="mt-12">
            <Card
              className="
                relative p-10
                bg-slate-900/70
                backdrop-blur
                border border-white/10
                transition-all duration-300
                hover:shadow-2xl hover:shadow-black/40
              "
            >
              <div className="flex items-center justify-between mb-6">
                <div className="text-sm uppercase tracking-wider text-slate-400">
                  Tendência de risco
                </div>
                <div className="text-xs text-blue-400">
                  Últimos 90 dias
                </div>
              </div>

              <svg viewBox="0 0 600 200" className="w-full h-40">
                <defs>
                  <linearGradient
                    id="exec-line"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                  >
                    <stop
                      offset="0%"
                      stopColor="rgba(59,130,246,0.25)"
                    />
                    <stop
                      offset="100%"
                      stopColor="rgba(59,130,246,1)"
                    />
                  </linearGradient>
                </defs>

                <polyline
                  fill="none"
                  stroke="url(#exec-line)"
                  strokeWidth="3"
                  points="
                    0,140
                    80,130
                    160,120
                    240,135
                    320,110
                    400,95
                    480,85
                    560,75
                  "
                />
              </svg>

              <p className="mt-4 text-sm text-slate-300">
                Tendência ascendente indica aumento de risco por
                recorrência de atrasos e falhas de execução.
              </p>
            </Card>
          </div>

          {/* DISCLAIMER */}
          <p className="mt-8 text-xs text-slate-400">
            * Exemplo ilustrativo baseado no modelo real do painel
            executivo do sistema.
          </p>
        </div>
      </SectionBase>
    </section>
  )
}
