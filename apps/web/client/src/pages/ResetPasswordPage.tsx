import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, LockKeyhole } from "lucide-react";

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

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const resetPasswordMutation = trpc.nexo.auth.resetPassword.useMutation();

  const search =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;

  const token = search?.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const errorText = useMemo(() => {
    if (localError) return localError;
    const err = resetPasswordMutation.error as any;
    if (typeof err?.message === "string") return err.message;
    return null;
  }, [localError, resetPasswordMutation.error]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!token) {
      setLocalError("Token de redefinição ausente ou inválido.");
      return;
    }

    if (!password) {
      setLocalError("Informe a nova senha.");
      return;
    }

    if (password.length < 8) {
      setLocalError("A senha precisa ter ao menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("As senhas não coincidem.");
      return;
    }

    try {
      await resetPasswordMutation.mutateAsync({
        token,
        password,
      });
      setDone(true);
    } catch (err: any) {
      setLocalError(
        typeof err?.message === "string"
          ? err.message
          : "Erro ao redefinir senha."
      );
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
                Nova senha
              </Badge>
              <div>
                <CardTitle className="text-2xl">Redefinir senha</CardTitle>
                <CardDescription className="mt-2 text-sm leading-6">
                  Defina sua nova senha para voltar ao jogo sem drama.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              {done ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Senha redefinida com sucesso.
                  </div>

                  <Button className="w-full" onClick={() => navigate("/login")}>
                    Ir para login
                  </Button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="password">Nova senha</Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="No mínimo 8 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Repita a nova senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
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
                    disabled={resetPasswordMutation.isPending}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {resetPasswordMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar nova senha"
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
