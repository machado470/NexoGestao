#!/usr/bin/env bash
set -e

echo ">> Iniciando criação automática da estrutura do Next.js..."

cd apps/site

echo ">> Limpando diretórios antigos..."
rm -rf src/app/auth src/app/dashboard src/app/auth_tmp src/app/dashboard_tmp

echo ">> Criando diretórios..."
mkdir -p src/app/auth
mkdir -p src/app/dashboard
mkdir -p src/components/ui
mkdir -p src/lib

echo ">> Criando Navbar..."
cat << 'EOF' > src/components/ui/Navbar.tsx
export default function Navbar() {
  return (
    <div className="p-4 bg-neutral-900 text-white font-semibold">
      AutoEscola-Sim
    </div>
  );
}
EOF

echo ">> Criando Sidebar..."
cat << 'EOF' > src/components/ui/Sidebar.tsx
export default function Sidebar() {
  return (
    <aside className="w-56 bg-black h-screen p-4 text-white">
      <nav className="flex flex-col gap-3">
        <a href="/dashboard">Dashboard</a>
        <a href="/auth">Login</a>
      </nav>
    </aside>
  );
}
EOF

echo ">> Criando layout do Dashboard..."
cat << 'EOF' > src/app/dashboard/layout.tsx
import Sidebar from "@/components/ui/Sidebar";
import Navbar from "@/components/ui/Navbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1">
        <Navbar />
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
EOF

echo ">> Criando página Dashboard..."
cat << 'EOF' > src/app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p>Bem-vindo ao painel da AutoEscola-Sim.</p>
    </div>
  );
}
EOF

echo ">> Criando página de Login..."
cat << 'EOF' > src/app/auth/page.tsx
export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-8 bg-neutral-900 rounded-xl shadow-xl w-80">
        <h2 className="text-xl font-bold mb-4 text-white">Login</h2>

        <form className="flex flex-col gap-4">
          <div>
            <label className="text-white text-sm">Email</label>
            <input
              type="email"
              className="bg-neutral-800 text-white w-full p-2 rounded"
            />
          </div>

          <div>
            <label className="text-white text-sm">Senha</label>
            <input
              type="password"
              className="bg-neutral-800 text-white w-full p-2 rounded"
            />
          </div>

          <button className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
EOF

echo ">> Estrutura criada com sucesso!"
