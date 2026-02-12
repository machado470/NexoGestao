import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">
          JurisFlow
        </h1>
        <p className="text-slate-400 max-w-md">
          Gestão de risco, trilhas e ações corretivas
          para escritórios jurídicos.
        </p>
        <Link
          to="/login"
          className="inline-block bg-blue-600 px-6 py-3 rounded text-white"
        >
          Entrar no sistema
        </Link>
      </div>
    </div>
  )
}
