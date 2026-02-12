import { Link } from 'react-router-dom'
import Card from '../../components/base/Card'
import SectionBase from '../../components/layout/SectionBase'

export default function CTA() {
  return (
    <section className="relative overflow-hidden">
      {/* FUNDO */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black via-slate-950 to-slate-950" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_30%,rgba(59,130,246,0.18),transparent_45%)]" />

      <SectionBase>
        <div className="max-w-5xl mx-auto px-6 py-40">
          <Card
            className="
              relative p-16
              bg-slate-900/80
              backdrop-blur
              border border-white/10
              shadow-2xl shadow-black/40
              text-center
            "
          >
            <h2 className="text-3xl md:text-4xl font-semibold text-white leading-tight">
              Governança não se promete.
              <br />
              <span className="text-blue-400">
                Ela se executa.
              </span>
            </h2>

            <p className="mt-6 text-lg text-slate-300 max-w-2xl mx-auto">
              Veja o JurisFlow operando em um ambiente real ou entre
              diretamente no sistema se você já possui acesso.
            </p>

            <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://wa.me/5500000000000"
                className="
                  px-10 py-4 rounded-xl
                  bg-blue-600 text-white font-medium
                  hover:bg-blue-500
                  transition-all duration-200
                  shadow-lg shadow-blue-600/25
                "
              >
                Solicitar acesso guiado
              </a>

              <Link
                to="/login"
                className="
                  px-10 py-4 rounded-xl
                  border border-white/20 text-white
                  hover:bg-white/5
                  transition-all duration-200
                "
              >
                Entrar no sistema
              </Link>
            </div>

            <p className="mt-8 text-sm text-slate-400">
              Sem compromisso comercial. Sem pressão. Apenas uma visão
              clara do funcionamento.
            </p>
          </Card>
        </div>
      </SectionBase>
    </section>
  )
}
