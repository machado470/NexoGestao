import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Mail } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function normalizeErrorMessage(error: unknown): string {
  const message =
    typeof error === "string"
      ? error
      : typeof (error as any)?.message === "string"
        ? (error as any).message
        : "Erro ao solicitar redefinição de senha.";

  const normalized = message.toLowerCase();

  if (
    normalized.includes("não está disponível no momento") ||
    normalized.includes("nao esta disponivel no momento") ||
    normalized.includes("recuperação de senha por e-mail") ||
    normalized.includes("recuperacao de senha por e-mail")
  ) {
    return "A recuperação por e-mail ainda não está disponível neste ambiente.";
  }

  return message;
}

export default function ForgotPasswordPage() {
  const [, navigate] = useLocation();
  const forgotPasswordMutation = trpc.nexo.auth.forgotPassword.useMutation();

  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const errorText = useMemo(() => {
    if (localError) return localError;
    return forgotPasswordMutation.error
      ? normalizeErrorMessage(forgotPasswordMutation.error)
      : null;
  }, [localError, forgotPasswordMutation.error]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setWarning(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setLocalError("Informe seu email.");
      return;
    }

    try {
      await forgotPasswordMutation.mutateAsync({ email: normalizedEmail });
      setDone(true);
    } catch (err) {
      const normalized = normalizeErrorMessage(err);
      if (normalized.includes("ainda não está disponível")) {
        setDone(true);
        setWarning(
          "Recuperação por e-mail indisponível neste ambiente. Peça ao administrador para redefinir sua senha.",
        );
        return;
      }
      setLocalError(normalizeErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar para login
          </button>

          <Card className="border-border/80 bg-card/95 shadow-xl">
            <CardHeader className="space-y-3">
              <Badge variant="outline" className="w-fit">
                Recuperação de acesso
              </Badge>
              <div>
                <CardTitle className="text-2xl">Esqueci minha senha</CardTitle>
                <CardDescription className="mt-2 text-sm leading-6">
                  Informe seu email para receber o link de redefinição.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              {done ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {warning ??
                      "Se esse email existir, você vai receber um link de redefinição."}
                  </div>

                  <Button className="w-full" onClick={() => navigate("/login")}>
                    Voltar para login
                  </Button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="voce@empresa.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {errorText ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                      {errorText}
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={forgotPasswordMutation.isPending}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {forgotPasswordMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Enviar link"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
