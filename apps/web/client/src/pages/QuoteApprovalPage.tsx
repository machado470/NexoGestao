import { useEffect, useRef, useState, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { quoteAnswer, type PublicQuote } from "@shared/service-quotes";
import { QuoteSummary } from "@/components/QuoteSummary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function QuoteApprovalPage() {
  const [token, setToken] = useState(() => window.location.hash.slice(1)),
    tokenRef = useRef(token);
  tokenRef.current = token;
  const [record, setRecord] = useState<PublicQuote | null>(null),
    [error, setError] = useState(""),
    [name, setName] = useState(""),
    [note, setNote] = useState(""),
    [decision, setDecision] = useState<"ACCEPTED" | "REJECTED">("ACCEPTED"),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false);
  const view = trpc.serviceQuotes.view.useMutation(),
    respond = trpc.serviceQuotes.respond.useMutation(),
    lock = useRef(false),
    keys = useRef(new Map<string, string>()),
    started = useRef<string | null>(null);
  async function load() {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      setError("Link inválido. Solicite outro à empresa.");
      return;
    }
    setError("");
    try {
      const result = await view.mutateAsync({ token });
      if (tokenRef.current === token) setRecord(result);
    } catch (e) {
      if (tokenRef.current === token)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível consultar o orçamento."
        );
    }
  }
  useEffect(() => {
    const changed = () => setToken(window.location.hash.slice(1));
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    if (started.current !== token) {
      started.current = token;
      setRecord(null);
      setName("");
      setNote("");
      setConfirmed(false);
      setDecision("ACCEPTED");
      void load();
    }
  }, [token]);
  useEffect(() => {
    const robots = document.createElement("meta"),
      referrer = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    referrer.name = "referrer";
    referrer.content = "no-referrer";
    document.head.append(robots, referrer);
    return () => {
      robots.remove();
      referrer.remove();
    };
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    const body = {
      token,
      decision,
      respondentName: name.trim(),
      responseNote: note.trim() || undefined,
      confirmed,
    };
    const key = JSON.stringify(body);
    let responseKey = keys.current.get(key);
    if (!responseKey) {
      responseKey = crypto.randomUUID();
      keys.current.set(key, responseKey);
    }
    const input = quoteAnswer.safeParse({ ...body, responseKey });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? "Confira os campos.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await respond.mutateAsync(input.data);
      if (tokenRef.current === token) setRecord(result);
    } catch (e) {
      if (tokenRef.current === token)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível registrar. Seus dados foram preservados."
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="min-h-dvh bg-[var(--bg-app)] px-4 py-8 text-[var(--text-primary)]">
      <div className="mx-auto grid w-full max-w-xl gap-4">
        <p className="text-sm font-semibold">
          NexoGestão · Aprovação de orçamento
        </p>
        <section className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
          {!record ? (
            <>
              <h1 className="text-2xl font-semibold">Conferir orçamento</h1>
              <p
                role={view.isPending ? "status" : "alert"}
                className="mt-3 break-words text-sm"
              >
                {view.isPending
                  ? "Consultando proposta..."
                  : error || "Link indisponível."}
              </p>
              <Button
                className="mt-3 min-h-11"
                disabled={view.isPending}
                onClick={() => void load()}
              >
                Tentar novamente
              </Button>
            </>
          ) : (
            <>
              <p className="mb-2 break-words text-sm text-[var(--text-muted)]">
                {record.companyName} · Versão {record.version + 1}
              </p>
              <h1 className="mb-4 text-2xl font-semibold">
                Conferir orçamento
              </h1>
              <QuoteSummary snapshot={record} />
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                Link válido até{" "}
                {new Date(record.expiresAt).toLocaleString("pt-BR")}. Quem
                possui este link pode responder. O nome informado não verifica
                identidade e não é assinatura digital.
              </p>
              {record.decision ? (
                <div
                  role="status"
                  className="mt-4 rounded-xl border border-[var(--border-subtle)] p-4"
                >
                  <h2 className="font-semibold">
                    {record.decision === "ACCEPTED"
                      ? "Orçamento aprovado"
                      : "Recusa registrada"}
                  </h2>
                  <p className="mt-2 text-sm">
                    Resposta registrada em{" "}
                    {record.respondedAt
                      ? new Date(record.respondedAt).toLocaleString("pt-BR")
                      : ""}
                    . Combine os próximos passos diretamente com a empresa.
                    Nenhum pagamento foi realizado por esta página.
                  </p>
                </div>
              ) : (
                <form onSubmit={submit} className="mt-5 grid min-w-0 gap-3">
                  <fieldset disabled={busy} className="grid min-w-0 gap-3">
                    <label htmlFor="quote-answer-name">Seu nome</label>
                    <Input
                      id="quote-answer-name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      minLength={2}
                      maxLength={120}
                      autoComplete="name"
                    />
                    <label className="flex min-h-11 items-center gap-3">
                      <input
                        type="radio"
                        name="quote-decision"
                        checked={decision === "ACCEPTED"}
                        onChange={() => setDecision("ACCEPTED")}
                      />
                      Aprovar este orçamento
                    </label>
                    <label className="flex min-h-11 items-center gap-3">
                      <input
                        type="radio"
                        name="quote-decision"
                        checked={decision === "REJECTED"}
                        onChange={() => setDecision("REJECTED")}
                      />
                      Recusar e explicar o motivo
                    </label>
                    <label htmlFor="quote-answer-note">
                      {decision === "REJECTED"
                        ? "Motivo da recusa"
                        : "Observação (opcional)"}
                    </label>
                    <textarea
                      id="quote-answer-note"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      maxLength={1000}
                      required={decision === "REJECTED"}
                      minLength={decision === "REJECTED" ? 10 : undefined}
                      className="min-h-28 rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] p-3 text-base text-[var(--field-text)]"
                    />
                    <label className="flex min-h-11 items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={e => setConfirmed(e.target.checked)}
                        className="mt-1"
                      />
                      Li os itens, valores e condições e confirmo a decisão
                      selecionada.
                    </label>
                  </fieldset>
                  {error && (
                    <p
                      role="alert"
                      className="break-words text-sm text-[var(--danger)]"
                    >
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="min-h-11 whitespace-normal"
                    disabled={busy}
                  >
                    {busy
                      ? "Registrando..."
                      : decision === "ACCEPTED"
                        ? "Confirmar aprovação"
                        : "Confirmar recusa"}
                  </Button>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
