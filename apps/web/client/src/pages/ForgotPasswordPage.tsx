import React, { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // placeholder enquanto não existe passwordReset no TRPC
    setDone(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border p-6 dark:border-zinc-800">
        <h1 className="mb-4 text-xl font-semibold">Esqueci minha senha</h1>

        {done ? (
          <p className="text-sm opacity-80">
            Se esse email existir, você vai receber um link de redefinição.
          </p>
        ) : (
          <>
            <input
              className="w-full rounded-lg border p-2 dark:bg-zinc-950"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <button className="mt-4 w-full rounded-lg bg-black px-4 py-2 text-white dark:bg-white dark:text-black">
              Enviar link
            </button>
          </>
        )}
      </form>
    </div>
  );
}
