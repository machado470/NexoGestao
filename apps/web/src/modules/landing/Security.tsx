import Card from '../../components/base/Card'
import SectionBase from '../../components/layout/SectionBase'

const pillars = [
  {
    title: 'Proteção jurídica',
    description:
      'Decisões, execuções e ações ficam registradas de forma rastreável, reduzindo exposição jurídica em auditorias e questionamentos.',
  },
  {
    title: 'Controle de acesso',
    description:
      'Papéis bem definidos, permissões claras e separação de responsabilidades. Cada usuário vê e executa apenas o que lhe compete.',
  },
  {
    title: 'Integridade dos dados',
    description:
      'Registros imutáveis e consistentes. O histórico não depende de boa-fé nem pode ser alterado retroativamente.',
  },
  {
    title: 'Conformidade contínua',
    description:
      'A conformidade não é um evento pontual. O sistema monitora comportamento real e reage automaticamente a desvios.',
  },
]

export default function Security() {
  return (
    <section className="relative overflow-hidden">
      {/* FUNDO */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950 via-black to-black" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_40%_30%,rgba(59,130,246,0.10),transparent_45%)]" />

      <SectionBase>
        <div className="max-w-7xl mx-auto px-6 py-32">
          {/* CABEÇALHO */}
          <div className="max-w-3xl mb-24">
            <span className="inline-block mb-4 px-4 py-1.5 text-xs tracking-wider uppercase rounded-full border border-blue-400/20 text-blue-300 bg-blue-500/5">
              Segurança e conformidade
            </span>

            <h2 className="text-3xl md:text-4xl font-semibold text-white leading-tight">
              Segurança não é promessa.
              <br />
              <span className="text-blue-400">
                É proteção quando algo dá errado.
              </span>
            </h2>

            <p className="mt-6 text-lg text-slate-300">
              O JurisFlow foi projetado para operar em ambientes reais,
              com falhas humanas, atrasos e decisões imperfeitas —
              mantendo rastreabilidade, controle e defesa operacional.
            </p>
          </div>

          {/* PILARES */}
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map(p => (
              <Card
                key={p.title}
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
                  {p.title}
                </h3>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {p.description}
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

