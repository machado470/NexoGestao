import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  acceptanceResponse,
  type acceptancePublic,
} from "@shared/service-acceptance";
import type { z } from "zod";

export default function ServiceAcceptancePage() {
  const [token, setToken] = useState(() => window.location.hash.slice(1));
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const view = trpc.serviceAcceptance.view.useMutation(),
    respond = trpc.serviceAcceptance.respond.useMutation();
  const [record, setRecord] = useState<z.infer<typeof acceptancePublic> | null>(
      null
    ),
    [error, setError] = useState(""),
    [name, setName] = useState(""),
    [note, setNote] = useState(""),
    [decision, setDecision] = useState<"ACCEPTED" | "ISSUE">("ACCEPTED"),
    [confirmed, setConfirmed] = useState(false);
  const lock = useRef(false),
    keys = useRef(new Map<string, string>()),
    started = useRef<string | null>(null);
  async function load() {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      setError("Link inválido. Solicite um novo link à empresa.");
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
            : "Não foi possível consultar o serviço."
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
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    const referrer = document.createElement("meta");
    referrer.name = "referrer";
    referrer.content = "no-referrer";
    document.head.appendChild(referrer);
    return () => {
      meta.remove();
      referrer.remove();
    };
  }, []);
  useEffect(() => {
    if (record?.decision || (!name && !note && !confirmed)) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [name, note, confirmed, record?.decision]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    const fingerprint = JSON.stringify([
      token,
      decision,
      name.trim(),
      note.trim(),
    ]);
    let responseKey = keys.current.get(fingerprint);
    if (!responseKey) {
      responseKey = crypto.randomUUID();
      keys.current.set(fingerprint, responseKey);
    }
    const input = acceptanceResponse.safeParse({
      token,
      responseKey,
      decision,
      respondentName: name,
      responseNote: note || undefined,
      confirmed,
    });
    if (!input.success) {
      setError(
        "Informe seu nome, confirme a decisão e descreva o problema quando necessário."
      );
      return;
    }
    lock.current = true;
    setError("");
    try {
      const result = await respond.mutateAsync(input.data);
      if (tokenRef.current === token) setRecord(result);
    } catch (e) {
      if (tokenRef.current === token)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível registrar. Seus dados continuam no formulário."
        );
    } finally {
      lock.current = false;
    }
  }
  return (
    <main className="min-h-dvh bg-[var(--bg-app)] px-4 py-8 text-[var(--text-primary)]">
      <div className="mx-auto grid w-full max-w-xl gap-5">
        <p className="text-sm font-semibold">
          NexoGestão · Confirmação de entrega
        </p>
        <section className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5">
          {!record ? (
            <>
              <h1 className="text-2xl font-semibold">Conferir serviço</h1>
              {view.isPending ? (
                <p role="status" className="mt-4">
                  Consultando o resumo...
                </p>
              ) : (
                <p role="alert" className="mt-4 break-words">
                  {error || "Link indisponível."}
                </p>
              )}
              <Button
                className="mt-4 min-h-11"
                disabled={view.isPending}
                onClick={() => void load()}
              >
                Tentar novamente
              </Button>
            </>
          ) : (
            <>
              <p className="break-words text-sm text-[var(--text-muted)]">
                {record.companyName}
              </p>
              <h1 className="mt-2 break-words text-2xl font-semibold">
                {record.publicTitle}
              </h1>
              <p className="mt-4 whitespace-pre-wrap break-words text-sm">
                {record.publicSummary}
              </p>
              {record.decision ? (
                <div
                  role="status"
                  className="mt-6 rounded-xl border border-[var(--border-subtle)] p-4"
                >
                  <h2 className="font-semibold">
                    {record.decision === "ACCEPTED"
                      ? "Entrega confirmada"
                      : "Problema registrado"}
                  </h2>
                  <p className="mt-2 text-sm">
                    {record.decision === "ACCEPTED"
                      ? "Sua confirmação foi registrada."
                      : "A empresa pode consultar seu relato. Combine com ela os próximos passos."}
                  </p>
                  <p className="mt-2 text-sm">
                    {record.respondedAt
                      ? new Date(record.respondedAt).toLocaleString("pt-BR")
                      : ""}
                  </p>
                </div>
              ) : (
                <form onSubmit={submit} className="mt-6 grid min-w-0 gap-4">
                  <fieldset
                    disabled={respond.isPending}
                    className="grid min-w-0 gap-4"
                  >
                    <label
                      htmlFor="acceptance-name"
                      className="text-sm font-medium"
                    >
                      Seu nome
                    </label>
                    <Input
                      id="acceptance-name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      minLength={2}
                      maxLength={120}
                      required
                      autoComplete="name"
                    />
                    <fieldset className="grid gap-2">
                      <legend className="mb-2 text-sm font-medium">
                        Como ficou a entrega?
                      </legend>
                      <label className="flex min-h-11 items-center gap-3 text-sm">
                        <input
                          type="radio"
                          name="decision"
                          checked={decision === "ACCEPTED"}
                          onChange={() => {
                            setDecision("ACCEPTED");
                            setConfirmed(false);
                          }}
                        />
                        Confirmar entrega
                      </label>
                      <label className="flex min-h-11 items-center gap-3 text-sm">
                        <input
                          type="radio"
                          name="decision"
                          checked={decision === "ISSUE"}
                          onChange={() => {
                            setDecision("ISSUE");
                            setConfirmed(false);
                          }}
                        />
                        Apontar um problema
                      </label>
                    </fieldset>
                    <label
                      htmlFor="acceptance-note"
                      className="text-sm font-medium"
                    >
                      {decision === "ISSUE"
                        ? "Descreva o problema"
                        : "Observação (opcional)"}
                    </label>
                    <textarea
                      id="acceptance-note"
                      className="min-h-28 min-w-0 rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] p-3 text-base text-[var(--field-text)]"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      maxLength={1000}
                      minLength={decision === "ISSUE" ? 10 : undefined}
                      required={decision === "ISSUE"}
                    />
                    <label className="flex min-h-11 items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 size-5 shrink-0"
                        checked={confirmed}
                        onChange={e => setConfirmed(e.target.checked)}
                        required
                      />
                      <span>
                        Li o resumo e confirmo o envio desta resposta. Ela não
                        poderá ser alterada por este link.
                      </span>
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
                    className="min-h-11 w-full"
                    disabled={respond.isPending || !confirmed}
                  >
                    {respond.isPending ? "Registrando..." : "Enviar resposta"}
                  </Button>
                  <p className="text-xs text-[var(--text-muted)]">
                    Link válido até{" "}
                    {new Date(record.expiresAt).toLocaleString("pt-BR")}. Esta
                    resposta não registra pagamento.
                  </p>
                </form>
              )}
              <p className="mt-5 text-xs text-[var(--text-muted)]">
                Confirmação por link de acesso e nome informado, sem verificação
                de identidade ou assinatura digital. Não encaminhe este link a
                terceiros.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
