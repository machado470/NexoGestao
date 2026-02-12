import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />

      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
