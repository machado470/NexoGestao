import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const trustItems = [
  "Sessão protegida por autenticação da plataforma",
  "Acesso rápido ao ambiente operacional da empresa",
  "Fluxo direto para dashboard ou onboarding, sem circo",
];

function normalizeErrorMessage(error: unknown): string {
  const message =
    typeof error === "string"
      ? error
      : typeof (error as any)?.message === "string"
        ? (error as any).message
        : "Erro ao fazer login";

  const normalized = message.toLowerCase();

  if (
    normalized.includes("senha inválida") ||
    normalized.includes("usuário inválido") ||
    normalized.includes("credenciais inválidas") ||
    normalized.includes("invalid credentials")
  ) {
    return "Email ou senha inválidos.";
  }

  if (
    normalized.includes("não autenticado") ||
    normalized.includes("unauthorized") ||
    normalized.includes("unauthenticated")
  ) {
    return "Sua sessão não pôde ser validada. Tente entrar novamente.";
  }

  if (normalized.includes("conta não ativada")) {
    return "Sua conta ainda não está ativada.";
  }

  if (normalized.includes("usuário sem identidade operacional")) {
    return "Sua conta está sem vínculo operacional. Verifique o cadastro.";
  }

  return message;
}

function getSafeRedirectParam(): string | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const value = (params.get("redirect") ?? "").trim();

  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.startsWith("/login")) return null;
  if (value.startsWith("/register")) return null;
  if (value.startsWith("/forgot-password")) return null;
  if (value.startsWith("/reset-password")) return null;

  return value;
}

export default function Login() {
  const { login, isSubmitting, error, redirectTo } = useAuth();
  const [, navigate] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const errorText = useMemo(() => {
    if (localError) return localError;
    if (!error) return null;
    return normalizeErrorMessage(error);
  }, [localError, error]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setLocalError("Preencha email e senha.");
      return;
    }

    try {
      await login(normalizedEmail, password);
      navigate(getSafeRedirectParam() || redirectTo || "/dashboard");
    } catch (err) {
      setLocalError(normalizeErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r bg-muted/30 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_30%)]" />
          <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
            <div>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="flex items-center gap-3"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <span className="text-lg font-bold">N</span>
                </div>
                <div className="text-left">
                  <div className="text-base font-semibold leading-none">NexoGestão</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    operação centralizada de verdade
                  </div>
                </div>
              </button>

              <div className="mt-16 max-w-xl">
                <Badge variant="outline" className="mb-4">
                  Acesso à plataforma
                </Badge>

                <h1 className="text-4xl font-bold tracking-tight xl:text-5xl">
                  Entre no ambiente onde a operação deixa de viver no improviso
                </h1>

                <p className="mt-6 text-base leading-7 text-muted-foreground xl:text-lg">
                  Clientes, agenda, ordens, financeiro e visão operacional em um fluxo
                  mais claro. Menos bagunça administrativa. Mais contexto para decidir.
                </p>

                <div className="mt-10 space-y-4">
                  {trustItems.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-xl border bg-card/80 p-4 shadow-sm"
                    >
                      <ShieldCheck className="mt-0.5 size-5 text-primary" />
                      <p className="text-sm text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card/85 p-6 shadow-sm">
              <div className="text-sm font-medium">Fluxo recomendado</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-background p-4">
                  <div className="text-xs text-muted-foreground">01</div>
                  <div className="mt-2 font-semibold">Entrar</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Acesse sua conta com email e senha.
                  </p>
                </div>
                <div className="rounded-xl border bg-background p-4">
                  <div className="text-xs text-muted-foreground">02</div>
                  <div className="mt-2 font-semibold">Validar sessão</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A plataforma carrega seu contexto de acesso.
                  </p>
                </div>
                <div className="rounded-xl border bg-background p-4">
                  <div className="text-xs text-muted-foreground">03</div>
                  <div className="mt-2 font-semibold">Operar</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Siga para o dashboard ou onboarding.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center p-6 sm:p-8 lg:p-10">
          <div className="w-full max-w-md">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            >
              <ArrowLeft className="size-4" />
              Voltar para a página inicial
            </button>

            <Card className="border-border/80 bg-card/95 shadow-xl">
              <CardHeader className="space-y-3">
                <Badge variant="outline" className="w-fit">
                  Entrar
                </Badge>
                <div>
                  <CardTitle className="text-2xl">Acessar plataforma</CardTitle>
                  <CardDescription className="mt-2 text-sm leading-6">
                    Use suas credenciais para entrar no ambiente da sua empresa.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent>
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

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="password">Senha</Label>
                      <button
                        type="button"
                        onClick={() => navigate("/forgot-password")}
                        className="text-xs text-primary hover:underline"
                      >
                        Esqueci minha senha
                      </button>
                    </div>

                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Sua senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
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
                    disabled={isSubmitting}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      "Entrar"
                    )}
                  </Button>
                </form>

                <div className="mt-6 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Ainda não tem acesso?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/register")}
                    className="font-medium text-primary hover:underline"
                  >
                    Criar conta
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
