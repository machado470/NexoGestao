import Card from '../../components/base/Card'
import SectionBase from '../../components/layout/SectionBase'

const modules = [
  {
    title: 'Pessoas',
    description:
      'Gestão clara de pessoas, papéis e responsabilidades. Cada usuário opera dentro de um contexto organizacional definido.',
  },
  {
    title: 'Trilhas de treinamento',
    description:
      'Conteúdos e avaliações atribuídos conforme função, risco e histórico. O aprendizado deixa de ser genérico.',
  },
  {
    title: 'Avaliações',
    description:
      'Execuções registradas, resultados mensurados e histórico completo por pessoa e por trilha.',
  },
  {
    title: 'Risco humano',
    description:
      'Cálculo automático de risco baseado em comportamento real, recorrência e gravidade.',
  },
  {
    title: 'Ações corretivas',
    description:
      'Quando o risco exige, o sistema gera ações obrigatórias e acompanha sua execução.',
  },
  {
    title: 'Auditoria',
    description:
      'Linha do tempo defensável de decisões, execuções e ações. Tudo rastreável.',
  },
]

export default function Modules() {
  return (
    <section className="relative overflow-hidden">
      {/* FUNDO */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black via-slate-950 to-slate-950" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_60%_30%,rgba(59,130,246,0.12),transparent_45%)]" />

      <SectionBase>
        <div className="max-w-7xl mx-auto px-6 py-32">
          {/* CABEÇALHO */}
          <div className="max-w-3xl mb-24">
            <span className="inline-block mb-4 px-4 py-1.5 text-xs tracking-wider uppercase rounded-full border border-blue-400/20 text-blue-300 bg-blue-500/5">
              Estrutura do sistema
            </span>

            <h2 className="text-3xl md:text-4xl font-semibold text-white leading-tight">
              Um sistema completo.
              <br />
              <span className="text-blue-400">
                Sem módulos soltos ou decorativos.
              </span>
            </h2>

            <p className="mt-6 text-lg text-slate-300">
              Cada módulo do JurisFlow existe para sustentar decisões
              reais, reduzir risco humano e garantir governança
              contínua — sem dependência de controles paralelos.
            </p>
          </div>

          {/* GRID DE MÓDULOS */}
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map(m => (
              <Card
                key={m.title}
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
                <h3 className="text-lg font-medium text-white mb-4">
                  {m.title}
                </h3>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {m.description}
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
