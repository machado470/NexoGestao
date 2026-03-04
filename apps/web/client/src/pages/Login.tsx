import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const errorText = (() => {
    if (localError) return localError;
    if (!error) return null;
    if (typeof error === "string") return error;
    if (typeof (error as any)?.message === "string") return (error as any).message;
    return "Erro ao fazer login";
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    try {
      await login(email, password);
    } catch {
      setLocalError("Email ou senha inválidos");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border p-6 dark:border-zinc-800">
        <h1 className="mb-4 text-xl font-semibold">Entrar</h1>

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
            autoComplete="current-password"
          />
        </div>

        <button
          disabled={loading}
          className="mt-4 w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        {errorText ? <p className="mt-3 text-sm text-red-500">{errorText}</p> : null}
      </form>
    </div>
  );
}
