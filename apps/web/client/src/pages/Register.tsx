import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Building2,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
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

const creationSteps = [
  "Cria a empresa no ambiente da plataforma",
  "Configura o usuário administrador inicial",
  "Autentica a sessão para seguir ao onboarding",
];

function normalizeErrorMessage(error: unknown): string {
  const message =
    typeof error === "string"
      ? error
      : typeof (error as any)?.message === "string"
        ? (error as any).message
        : "Erro ao criar conta";

  const normalized = message.toLowerCase();

  if (normalized.includes("email já cadastrado")) {
    return "Esse email já está em uso.";
  }

  if (normalized.includes("senha precisa ter ao menos 8")) {
    return "A senha precisa ter ao menos 8 caracteres.";
  }

  return message;
}

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
    return normalizeErrorMessage(error);
  }, [localError, error]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const orgName = formData.orgName.trim();
    const adminName = formData.adminName.trim();
    const email = formData.email.trim().toLowerCase();

    if (!orgName || !adminName || !email || !formData.password) {
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
        orgName,
        adminName,
        email,
        password: formData.password,
      });

      navigate("/onboarding");
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
                  Criar conta
                </Badge>

                <h1 className="text-4xl font-bold tracking-tight xl:text-5xl">
                  Comece com uma base operacional organizada desde o primeiro acesso
                </h1>

                <p className="mt-6 text-base leading-7 text-muted-foreground xl:text-lg">
                  Crie sua empresa, defina o administrador inicial e entre direto no
                  fluxo da plataforma. Sem novela burocrática e sem cadastro em cinco atos.
                </p>

                <div className="mt-10 space-y-4">
                  {creationSteps.map((item, index) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-xl border bg-card/80 p-4 shadow-sm"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        0{index + 1}
                      </div>
                      <p className="text-sm text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card/85 p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="size-4 text-primary" />
                O que acontece ao criar sua conta
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-background p-4">
                  <div className="text-xs text-muted-foreground">Empresa</div>
                  <div className="mt-2 font-semibold">Tenant inicial</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sua base nasce pronta para operar.
                  </p>
                </div>

                <div className="rounded-xl border bg-background p-4">
                  <div className="text-xs text-muted-foreground">Admin</div>
                  <div className="mt-2 font-semibold">Acesso principal</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Usuário administrador criado no mesmo fluxo.
                  </p>
                </div>

                <div className="rounded-xl border bg-background p-4">
                  <div className="text-xs text-muted-foreground">Sessão</div>
                  <div className="mt-2 font-semibold">Entrada imediata</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Login automático para seguir ao onboarding.
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
                  Nova conta
                </Badge>
                <div>
                  <CardTitle className="text-2xl">Criar acesso inicial</CardTitle>
                  <CardDescription className="mt-2 text-sm leading-6">
                    Configure a empresa e o administrador principal para começar.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent>
                <form onSubmit={submit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Nome da empresa</Label>
                    <div className="relative">
                      <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="orgName"
                        placeholder="Ex.: Nexo Serviços"
                        value={formData.orgName}
                        onChange={(e) =>
                          setFormData((s) => ({ ...s, orgName: e.target.value }))
                        }
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminName">Seu nome</Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="adminName"
                        placeholder="Seu nome completo"
                        value={formData.adminName}
                        onChange={(e) =>
                          setFormData((s) => ({ ...s, adminName: e.target.value }))
                        }
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="voce@empresa.com"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData((s) => ({ ...s, email: e.target.value }))
                        }
                        autoComplete="email"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="No mínimo 8 caracteres"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData((s) => ({ ...s, password: e.target.value }))
                        }
                        autoComplete="new-password"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar senha</Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Repita sua senha"
                        value={formData.confirmPassword}
                        onChange={(e) =>
                          setFormData((s) => ({
                            ...s,
                            confirmPassword: e.target.value,
                          }))
                        }
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
                    disabled={isSubmitting}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      "Criar conta"
                    )}
                  </Button>
                </form>

                <div className="mt-6 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Já tem acesso?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="font-medium text-primary hover:underline"
                  >
                    Entrar na plataforma
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
