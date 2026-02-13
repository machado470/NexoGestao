import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-black" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_0%,rgba(249,115,22,0.08),transparent_45%)]" />

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
          <div>
            <div className="text-lg font-semibold text-white">NexoGestao</div>
            <p className="mt-3 max-w-sm text-sm text-slate-400">
              Plataforma de governança operacional, risco humano e auditoria
              contínua para times e operações.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 text-sm">
            <Link to="/login" className="text-slate-300 hover:text-white transition">
              Entrar no sistema
            </Link>

            <a href="#" className="text-slate-300 hover:text-white transition">
              Contato
            </a>

            <span className="text-slate-500">Privacidade</span>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-xs text-slate-500">
          © {new Date().getFullYear()} NexoGestao. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  )
}
