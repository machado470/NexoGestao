import Card from '../../components/base/Card'
import SectionBase from '../../components/layout/SectionBase'

export default function Features() {
  const features = [
    {
      title: 'Decisões explicáveis',
      description:
        'Cada decisão é sustentada por dados reais, com histórico, contexto e justificativa clara.',
    },
    {
      title: 'Rastreabilidade jurídica',
      description:
        'Eventos críticos são registrados e auditáveis, permitindo defesa técnica de decisões.',
    },
    {
      title: 'Governança humana',
      description:
        'O sistema respeita exceções reais e atua como apoio à decisão, não como juiz automático.',
    },
  ]

  return (
    <SectionBase>
      <div className="max-w-2xl mb-20">
        <h2 className="text-3xl md:text-4xl font-semibold text-white">
          Governança prática, não teoria
        </h2>

        <p className="mt-4 text-slate-400">
          O JurisFlow foi projetado para ambientes reais, onde decisões
          precisam ser explicáveis, auditáveis e sustentáveis.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {features.map(f => (
          <Card key={f.title} variant="panel">
            <h3 className="text-lg font-medium text-white">
              {f.title}
            </h3>

            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              {f.description}
            </p>
          </Card>
        ))}
      </div>
    </SectionBase>
  )
}
