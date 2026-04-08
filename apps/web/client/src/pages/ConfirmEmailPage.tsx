import React, { useMemo } from "react";
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

function getToken() {
  if (typeof window === "undefined") return "";
  return (new URLSearchParams(window.location.search).get("token") ?? "").trim();
}

function getEmail() {
  if (typeof window === "undefined") return "";
  return (new URLSearchParams(window.location.search).get("email") ?? "").trim().toLowerCase();
}

export default function ConfirmEmailPage() {
  const [, navigate] = useLocation();
  const token = useMemo(() => getToken(), []);
  const queryEmail = useMemo(() => getEmail(), []);
  const [email, setEmail] = React.useState(queryEmail);
  const [resendMessage, setResendMessage] = React.useState<string | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const verifyMutation = trpc.nexo.auth.verifyEmail.useMutation();
  const resendMutation = trpc.nexo.auth.resendEmailVerification.useMutation();

  React.useEffect(() => {
    if (!token || verifyMutation.isSuccess || verifyMutation.isPending) return;
    verifyMutation.mutate({ token });
  }, [token, verifyMutation]);

  const hasError = verifyMutation.isError || !token;

  const resendVerification = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setLocalError("Informe seu e-mail para reenviar a confirmação.");
      return;
    }

    setLocalError(null);
    await resendMutation.mutateAsync({ email: normalizedEmail });
    setResendMessage("Se o e-mail existir, um novo link de confirmação será enviado.");
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
                Confirmação de e-mail
              </Badge>
              <div>
                <CardTitle className="text-2xl">Validar e-mail</CardTitle>
                <CardDescription className="mt-2 text-sm leading-6">
                  Confirme seu endereço para proteger o acesso da sua conta.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              {verifyMutation.isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Validando token...
                </div>
              ) : hasError ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                    O link de confirmação é inválido ou expirou. Solicite um novo e-mail de verificação no login.
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-email-resend">E-mail da conta</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirm-email-resend"
                        type="email"
                        value={email}
                        placeholder="voce@empresa.com"
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setResendMessage(null);
                        }}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  {localError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                      {localError}
                    </div>
                  ) : null}
                  {resendMessage ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {resendMessage}
                    </div>
                  ) : null}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={resendVerification}
                    disabled={resendMutation.isPending}
                  >
                    {resendMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Reenviando confirmação...
                      </>
                    ) : (
                      "Reenviar e-mail de confirmação"
                    )}
                  </Button>
                  <Button className="w-full" onClick={() => navigate("/login")}>Ir para login</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    E-mail confirmado com sucesso. Você já pode entrar na plataforma.
                  </div>
                  <Button className="w-full" onClick={() => navigate("/login")}>Entrar</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
