import Card from '../../components/base/Card'
import SectionBase from '../../components/layout/SectionBase'

export default function Governance() {
  return (
    <section className="relative overflow-hidden">
      {/* FUNDO SEPARADOR */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black via-slate-950 to-slate-950" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_70%_30%,rgba(59,130,246,0.15),transparent_45%)]" />

      <SectionBase>
        <div className="max-w-7xl mx-auto px-6 py-32">
          {/* CABEÇALHO */}
          <div className="max-w-3xl mb-20">
            <span className="inline-block mb-4 px-4 py-1.5 text-xs tracking-wider uppercase rounded-full border border-blue-400/20 text-blue-300 bg-blue-500/5">
              Governança operacional
            </span>

            <h2 className="text-3xl md:text-4xl font-semibold text-white leading-tight">
              Governança não é discurso.
              <br />
              <span className="text-blue-400">
                É mecanismo em execução contínua.
              </span>
            </h2>

            <p className="mt-6 text-lg text-slate-300">
              O JurisFlow transforma políticas, treinamentos e regras
              internas em um sistema vivo, capaz de medir risco,
              registrar decisões e exigir ação corretiva — sem depender
              de controle manual.
            </p>
          </div>

          {/* CARDS */}
          <div className="grid gap-8 md:grid-cols-3">
            {/* CARD 1 */}
            <Card
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
                Decisão rastreável
              </h3>

              <p className="text-sm text-slate-300 leading-relaxed">
                Cada decisão relevante nasce de um evento concreto:
                execução, avaliação ou atraso. Nada é subjetivo, nada é
                invisível.
              </p>

              <div className="absolute inset-0 pointer-events-none rounded-2xl bg-blue-500/5 opacity-0 hover:opacity-100 transition" />
            </Card>

            {/* CARD 2 */}
            <Card
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
                Risco mensurável
              </h3>

              <p className="text-sm text-slate-300 leading-relaxed">
                O risco humano não é opinião. Ele é recalculado
                automaticamente com base em comportamento real,
                recorrência e gravidade.
              </p>

              <div className="absolute inset-0 pointer-events-none rounded-2xl bg-blue-500/5 opacity-0 hover:opacity-100 transition" />
            </Card>

            {/* CARD 3 */}
            <Card
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
                Ação obrigatória
              </h3>

              <p className="text-sm text-slate-300 leading-relaxed">
                Quando o risco ultrapassa limites definidos, o sistema
                gera ações corretivas automaticamente. Governança que
                não age é apenas relatório.
              </p>

              <div className="absolute inset-0 pointer-events-none rounded-2xl bg-blue-500/5 opacity-0 hover:opacity-100 transition" />
            </Card>
          </div>
        </div>
      </SectionBase>
    </section>
  )
}

