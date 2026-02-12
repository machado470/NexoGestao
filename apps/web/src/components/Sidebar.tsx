import { NavLink } from 'react-router-dom'

const items = [
  { label: 'Visão Geral', to: '/admin' },
  { label: 'Pessoas', to: '/admin/persons' },
  { label: 'Pendências', to: '/admin/pending' },
  // próximas evoluções naturais:
  // { label: 'Trilhas', to: '/admin/tracks' },
  // { label: 'Avaliações', to: '/admin/assessments' },
  // { label: 'Ações Corretivas', to: '/admin/actions' },
]

export default function Sidebar() {
  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900">
      <div className="p-6 font-bold text-lg">JurisFlow</div>

      <nav className="px-4 space-y-1">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              `block rounded px-4 py-2 text-sm ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
