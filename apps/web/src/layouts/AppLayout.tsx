export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="h-14 flex items-center px-6 border-b border-zinc-800">
        <span className="font-bold text-red-500">JurisFlow</span>
      </header>

      <main className="p-6">
        {children}
      </main>
    </div>
  )
}
