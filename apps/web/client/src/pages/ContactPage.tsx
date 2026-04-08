import { useCallback, useState, type FormEvent } from "react";
import { Mail, MessageCircleMore, PhoneCall } from "lucide-react";

import { MarketingLayout } from "@/components/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

import "./landing.css";


export default function ContactPage() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleRequestDemo = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const name = String(form.get("name") ?? "").trim();
    const company = String(form.get("company") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const goals = String(form.get("goals") ?? "").trim();

    if (!name || !company || !email || !goals) {
      setStatusMessage("Preencha nome, empresa, email e objetivo para enviar.");
      return;
    }

    const subject = encodeURIComponent(`Solicitação de demonstração - ${company}`);
    const body = encodeURIComponent(
      [
        `Nome: ${name}`,
        `Empresa: ${company}`,
        `Email: ${email}`,
        `WhatsApp: ${phone || "Não informado"}`,
        "",
        "Objetivo operacional:",
        goals,
      ].join("\n")
    );

    window.location.href = `mailto:contato@nexogestao.com.br?subject=${subject}&body=${body}`;
    setStatusMessage("Abrimos seu cliente de e-mail para concluir o envio da solicitação.");
  }, []);

  usePageMeta({
    title: "NexoGestão | Contato",
    description:
      "Entre em contato com o time NexoGestão para agendar demonstração e estruturar sua operação.",
  });
  return (
    <MarketingLayout>
      <section className="container py-14 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.14em] text-orange-600">
            CONTATO
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900 md:text-5xl">
            Fale com a equipe do NexoGestão
          </h1>
          <p className="mt-5 text-lg text-slate-600">
            Se você quer organizar sua operação com mais controle, nós te
            mostramos o melhor próximo passo.
          </p>
        </div>
      </section>

      <section className="container pb-16 md:pb-20">
        <div className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="inline-flex rounded-xl bg-green-50 p-2.5 text-green-600">
              <MessageCircleMore className="size-5" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">
              WhatsApp
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Canal rápido para dúvidas comerciais e agendamento de
              demonstração.
            </p>
            <a
              href="https://wa.me/5511300000000"
              className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
            >
              Abrir WhatsApp
            </a>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="inline-flex rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <Mail className="size-5" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">Email</h2>
            <p className="mt-2 text-sm text-slate-600">
              Para propostas, parcerias e assuntos institucionais.
            </p>
            <a
              href="mailto:contato@nexogestao.com.br"
              className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
            >
              Enviar email
            </a>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="inline-flex rounded-xl bg-orange-50 p-2.5 text-orange-600">
              <PhoneCall className="size-5" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">
              Atendimento comercial
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Segunda a sexta, das 9h às 18h (BRT).
            </p>
            <p className="mt-5 text-sm font-semibold text-slate-700">
              Prazo de resposta: até 1 dia útil.
            </p>
          </article>
        </div>
      </section>

      <section className="container pb-16 md:pb-20">
        <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_45px_rgba(15,23,42,0.08)] md:p-10">
          <h2 className="text-2xl font-semibold text-slate-900">
            Solicitar demonstração
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Preencha o formulário e nossa equipe retorna com a melhor
            configuração para sua operação.
          </p>

          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleRequestDemo}>
            <label className="text-sm font-medium text-slate-700">
              Nome
              <input
                type="text"
                name="name"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none ring-orange-500/20 transition focus:ring-4"
                placeholder="Seu nome"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Empresa
              <input
                type="text"
                name="company"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none ring-orange-500/20 transition focus:ring-4"
                placeholder="Nome da empresa"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                name="email"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none ring-orange-500/20 transition focus:ring-4"
                placeholder="voce@empresa.com"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              WhatsApp
              <input
                type="tel"
                name="phone"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none ring-orange-500/20 transition focus:ring-4"
                placeholder="(11) 99999-9999"
              />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              O que você quer organizar primeiro?
              <textarea
                rows={4}
                name="goals"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none ring-orange-500/20 transition focus:ring-4"
                placeholder="Ex.: atendimento + ordens de serviço + cobrança"
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(249,115,22,0.35)] transition hover:bg-orange-600"
              >
                Quero falar com a equipe
              </button>
              {statusMessage ? (
                <p className="mt-3 text-sm text-slate-600">{statusMessage}</p>
              ) : null}
            </div>
          </form>
        </article>
      </section>
    </MarketingLayout>
  );
}
