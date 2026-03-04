import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function Register() {
  const { loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // placeholder: quando tiver useAuth().register, liga aqui
    setDone(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border p-6 dark:border-zinc-800">
        <h1 className="mb-4 text-xl font-semibold">Criar conta</h1>

        {done ? (
          <p className="text-sm opacity-80">Cadastro (mock). Agora liga na rota real.</p>
        ) : (
          <>
            <div className="space-y-3">
              <input
                className="w-full rounded-lg border p-2 dark:bg-zinc-950"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <input
                className="w-full rounded-lg border p-2 dark:bg-zinc-950"
                placeholder="Senha"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? "Criando..." : "Criar"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
