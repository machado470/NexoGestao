import Card from '../../components/base/Card'
import SectionBase from '../../components/layout/SectionBase'

const steps = [
  {
    step: '01',
    title: 'Entrada controlada',
    description:
      'O acesso ao sistema inicia com definição clara de papéis. Nenhum usuário opera fora de um contexto organizacional.',
  },
  {
    step: '02',
    title: 'Atribuição de trilhas',
    description:
      'Cada pessoa recebe trilhas de treinamento vinculadas à sua função, risco e histórico operacional.',
  },
  {
    step: '03',
    title: 'Execução monitorada',
    description:
      'O sistema acompanha execução, atrasos e resultados. Não há avanço sem registro.',
  },
  {
    step: '04',
    title: 'Cálculo automático de risco',
    description:
      'O risco humano é recalculado continuamente com base em comportamento real, recorrência e gravidade.',
  },
  {
    step: '05',
    title: 'Ação corretiva obrigatória',
    description:
      'Quando limites são ultrapassados, ações corretivas são geradas automaticamente e exigidas pelo sistema.',
  },
]

export default function HowItWorks() {
  return (
    <section className="relative overflow-hidden">
      {/* FUNDO */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950 via-black to-black" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.12),transparent_45%)]" />

      <SectionBase>
        <div className="max-w-7xl mx-auto px-6 py-32">
          {/* CABEÇALHO */}
          <div className="max-w-3xl mb-24">
            <span className="inline-block mb-4 px-4 py-1.5 text-xs tracking-wider uppercase rounded-full border border-blue-400/20 text-blue-300 bg-blue-500/5">
              Ciclo operacional
            </span>

            <h2 className="text-3xl md:text-4xl font-semibold text-white leading-tight">
              Um ciclo fechado.
              <br />
              <span className="text-blue-400">
                Sem atalhos. Sem exceções.
              </span>
            </h2>

            <p className="mt-6 text-lg text-slate-300">
              O JurisFlow não depende de boa vontade, lembretes manuais
              ou fiscalização informal. O sistema conduz pessoas,
              mede risco e exige ação de forma automática.
            </p>
          </div>

          {/* STEPS */}
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {steps.map(s => (
              <Card
                key={s.step}
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
                <div className="flex items-center gap-4 mb-6">
                  <div className="text-sm font-semibold text-blue-400">
                    {s.step}
                  </div>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <h3 className="text-lg font-medium text-white mb-4">
                  {s.title}
                </h3>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {s.description}
                </p>

                <div className="absolute inset-0 pointer-events-none rounded-2xl bg-blue-500/5 opacity-0 hover:opacity-100 transition" />
              </Card>
            ))}
          </div>
        </div>
      </SectionBase>
    </section>
  )
}
