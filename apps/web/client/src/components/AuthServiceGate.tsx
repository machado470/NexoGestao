import type { ReactNode } from "react";
import { Link } from "wouter";
import { BrandSignature } from "./BrandSignature";
import { PublicCard } from "./ui/context-cards";

export function AuthServiceGate({ children }: { children: ReactNode }) {
  if (import.meta.env.VITE_STATIC_HOSTING !== "true") return children;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <PublicCard className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <BrandSignature
          subtitle="Plataforma operacional"
          className="[&>div:nth-child(2)>p:first-child]:text-slate-900 [&>div:nth-child(2)>p:last-child]:text-slate-500"
        />
        <div role="status" className="mt-7 space-y-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            Acesso à plataforma indisponível
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            Neste endereço, você pode conhecer o NexoGestão. Login, cadastro e
            recuperação de senha ainda não estão disponíveis.
          </p>
        </div>
        <div className="mt-7 flex flex-col gap-3">
          <Link
            href="/produto"
            className="rounded-xl bg-orange-500 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-orange-600"
          >
            Conhecer a plataforma
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Voltar para a página inicial
          </Link>
        </div>
      </PublicCard>
    </main>
  );
}
