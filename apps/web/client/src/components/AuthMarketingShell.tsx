import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

import "@/pages/landing.css";

type AuthMarketingShellProps = {
  badge: string;
  title: string;
  description: string;
  asideTitle: string;
  asideDescription: string;
  asideItems: string[];
  bottomPanelTitle: string;
  bottomPanelSteps: Array<{ label: string; value: string; description: string }>;
  backTo?: string;
  backLabel?: string;
  children: ReactNode;
};

export function AuthMarketingShell({
  badge,
  title,
  description,
  asideTitle,
  asideDescription,
  asideItems,
  bottomPanelTitle,
  bottomPanelSteps,
  backTo = "/",
  backLabel = "Voltar para home",
  children,
}: AuthMarketingShellProps) {
  const [, navigate] = useLocation();

  return (
    <div className="landing-root min-h-screen text-slate-900">
      <main className="container py-6 sm:py-10">
        <div className="grid min-h-[calc(100vh-5rem)] overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/80 shadow-[0_25px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative hidden border-r border-slate-200/80 bg-white/70 lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_30%)]" />
            <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
              <div>
                <button type="button" onClick={() => navigate("/")} className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-content-center rounded-xl bg-slate-900 shadow-sm">
                    <div className="grid grid-cols-2 gap-1">
                      <span className="h-2.5 w-2.5 rounded-[3px] bg-white" />
                      <span className="h-2.5 w-2.5 rounded-[3px] bg-orange-500" />
                      <span className="h-2.5 w-2.5 rounded-[3px] bg-blue-500" />
                      <span className="h-2.5 w-2.5 rounded-[3px] bg-white" />
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-base font-semibold leading-none">NexoGestão</p>
                    <p className="mt-1 text-sm text-slate-500">operação centralizada de verdade</p>
                  </div>
                </button>

                <div className="mt-14 max-w-xl">
                  <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-orange-700">
                    {badge}
                  </span>
                  <h1 className="mt-5 text-4xl font-semibold leading-tight text-slate-900 xl:text-5xl">{asideTitle}</h1>
                  <p className="mt-6 text-base leading-7 text-slate-600 xl:text-lg">{asideDescription}</p>

                  <div className="mt-8 space-y-3">
                    {asideItems.map((item) => (
                      <div key={item} className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
                <p className="text-sm font-semibold text-slate-900">{bottomPanelTitle}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {bottomPanelSteps.map((step) => (
                    <div key={step.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">{step.label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{step.value}</p>
                      <p className="mt-1 text-xs text-slate-500">{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="flex min-h-screen items-center justify-center p-6 sm:p-8 lg:min-h-0 lg:p-10">
            <div className="w-full max-w-md">
              <button
                type="button"
                onClick={() => navigate(backTo)}
                className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900"
              >
                <ArrowLeft className="size-4" />
                {backLabel}
              </button>

              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:p-7">
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-700">
                  {badge}
                </span>
                <h2 className="mt-4 text-2xl font-semibold text-slate-900">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>

                <div className="mt-6">{children}</div>
              </article>

              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <a href="/" className="hover:text-slate-800">Home</a>
                <a href="/produto" className="hover:text-slate-800">Produto</a>
                <a href="/precos" className="hover:text-slate-800">Preços</a>
                <a href="/contato" className="hover:text-slate-800">Contato</a>
                <a href="/privacidade" className="hover:text-slate-800">Privacidade</a>
                <a href="/termos" className="hover:text-slate-800">Termos</a>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
