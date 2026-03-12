import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

export default function Register() {
  const { isSubmitting, error, register } = useAuth();
  const [, navigate] = useLocation();

  const [formData, setFormData] = useState({
    orgName: "",
    adminName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [localError, setLocalError] = useState<string | null>(null);

  const errorText = useMemo(() => {
    if (localError) return localError;
    if (!error) return null;
    if (typeof error === "string") return error;
    if (typeof (error as any)?.message === "string") return (error as any).message;
    return "Erro ao criar conta";
  }, [localError, error]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!formData.orgName || !formData.adminName || !formData.email || !formData.password) {
      setLocalError("Preencha todos os campos obrigatórios.");
      return;
    }

    if (formData.password.length < 8) {
      setLocalError("A senha precisa ter ao menos 8 caracteres.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setLocalError("As senhas não coincidem.");
      return;
    }

    try {
      await register({
        orgName: formData.orgName.trim(),
        adminName: formData.adminName.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      navigate("/onboarding");
    } catch (err: any) {
      const message =
        typeof err?.message === "string" ? err.message : "Erro ao criar conta";
      setLocalError(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border p-6 dark:border-zinc-800"
      >
        <h1 className="mb-1 text-xl font-semibold">Criar conta</h1>
        <p className="mb-4 text-sm opacity-80">
          Criamos sua empresa (tenant), usuário admin e sessão automaticamente.
        </p>

        <div className="space-y-3">
          <input
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Nome da empresa"
            value={formData.orgName}
            onChange={(e) => setFormData((s) => ({ ...s, orgName: e.target.value }))}
          />
          <input
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Seu nome"
            value={formData.adminName}
            onChange={(e) => setFormData((s) => ({ ...s, adminName: e.target.value }))}
          />
          <input
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData((s) => ({ ...s, email: e.target.value }))}
            autoComplete="email"
          />
          <input
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Senha"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData((s) => ({ ...s, password: e.target.value }))}
            autoComplete="new-password"
          />
          <input
            className="w-full rounded-lg border p-2 dark:bg-zinc-950"
            placeholder="Confirmar senha"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData((s) => ({ ...s, confirmPassword: e.target.value }))}
            autoComplete="new-password"
          />
        </div>

        <button
          disabled={isSubmitting}
          className="mt-4 w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {isSubmitting ? "Criando..." : "Criar conta"}
        </button>

        {errorText ? <p className="mt-3 text-sm text-red-500">{errorText}</p> : null}
      </form>
    </div>
  );
}
