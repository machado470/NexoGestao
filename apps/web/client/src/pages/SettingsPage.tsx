import React, { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Settings,
  Building2,
  Globe,
  Save,
  Loader2,
  ShieldCheck,
  Clock,
  Coins,
  AlertTriangle,
  RefreshCw,
  Lock,
  Sparkles,
} from "lucide-react";

type SettingsFormData = {
  name: string;
  timezone: string;
  currency: string;
};

type SettingsResponse = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
};

const DEFAULT_FORM: SettingsFormData = {
  name: "",
  timezone: "America/Sao_Paulo",
  currency: "BRL",
};

function normalizeSettingsPayload(payload: unknown): SettingsResponse | null {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;

  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Partial<SettingsResponse>;

  return {
    id: candidate.id ?? "",
    name: candidate.name ?? "",
    slug: candidate.slug ?? "",
    timezone: candidate.timezone ?? "America/Sao_Paulo",
    currency: candidate.currency ?? "BRL",
  };
}

function buildFormFromSettings(settings: SettingsResponse | null): SettingsFormData {
  if (!settings) return DEFAULT_FORM;

  return {
    name: settings.name || "",
    timezone: settings.timezone || "America/Sao_Paulo",
    currency: settings.currency || "BRL",
  };
}

function formsAreEqual(a: SettingsFormData, b: SettingsFormData) {
  return (
    a.name.trim() === b.name.trim() &&
    a.timezone === b.timezone &&
    a.currency === b.currency
  );
}

export default function SettingsPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canLoad = isAuthenticated && !isInitializing;

  const utils = trpc.useUtils();

  const query = trpc.nexo.settings.get.useQuery(undefined, {
    enabled: canLoad,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const settings = useMemo(() => normalizeSettingsPayload(query.data), [query.data]);
  const initialForm = useMemo(() => buildFormFromSettings(settings), [settings]);

  const [form, setForm] = useState<SettingsFormData>(DEFAULT_FORM);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  const hasChanges = useMemo(() => !formsAreEqual(form, initialForm), [form, initialForm]);

  const mutation = trpc.nexo.settings.update.useMutation({
    onSuccess: async (res) => {
      const normalized = normalizeSettingsPayload(res);
      if (normalized) setForm(buildFormFromSettings(normalized));

      toast.success("Configurações atualizadas");
      await utils.nexo.settings.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }

    if (!hasChanges) {
      toast.message("Nada para salvar.");
      return;
    }

    mutation.mutate({
      name: form.name.trim(),
      timezone: form.timezone,
      currency: form.currency,
    });
  };

  if (isInitializing || query.isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 text-sm text-zinc-500">
        Faça login para acessar configurações.
      </div>
    );
  }

  if (query.isError || !settings) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Erro ao carregar configurações
          </div>

          <button
            onClick={() => query.refetch()}
            className="mt-3 flex items-center gap-2 text-sm underline"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* HEADER PREMIUM */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs text-orange-700">
          <Sparkles className="h-3.5 w-3.5" />
          Configuração organizacional
        </div>

        <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold">
          <Settings className="h-6 w-6 text-orange-500" />
          Configurações
        </h1>

        <p className="mt-2 text-sm opacity-70">
          Ajuste o núcleo da operação: identidade da empresa, fuso e moeda.
        </p>
      </div>

      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800"
      >
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-orange-500" />
          <h3 className="font-semibold">Organização</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            name="name"
            value={form.name}
            onChange={(e) =>
              setForm((p) => ({ ...p, name: e.target.value }))
            }
            placeholder="Nome da empresa"
            className="rounded-md border px-3 py-2 text-sm dark:border-zinc-800"
          />

          <select
            name="timezone"
            value={form.timezone}
            onChange={(e) =>
              setForm((p) => ({ ...p, timezone: e.target.value }))
            }
            className="rounded-md border px-3 py-2 text-sm dark:border-zinc-800"
          >
            <option value="America/Sao_Paulo">Brasil</option>
            <option value="UTC">UTC</option>
          </select>

          <select
            name="currency"
            value={form.currency}
            onChange={(e) =>
              setForm((p) => ({ ...p, currency: e.target.value }))
            }
            className="rounded-md border px-3 py-2 text-sm dark:border-zinc-800"
          >
            <option value="BRL">Real</option>
            <option value="USD">Dólar</option>
          </select>

          <input
            disabled
            value={settings.slug}
            className="rounded-md border px-3 py-2 text-sm opacity-60 dark:border-zinc-800"
          />
        </div>

        <div className="mt-6 flex justify-between">
          <span className="text-xs opacity-60">
            {hasChanges ? "Alterações pendentes" : "Tudo salvo"}
          </span>

          <button
            type="submit"
            disabled={!hasChanges || mutation.isPending}
            className="flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-white disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </button>
        </div>
      </form>

      {/* SEGURANÇA */}
      <div className="rounded-2xl border p-6 dark:border-zinc-800">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-orange-500" />
          <h3 className="font-semibold">Segurança</h3>
        </div>

        <p className="text-sm opacity-70">
          Controle avançado ainda não exposto.
        </p>

        <button
          disabled
          className="mt-3 flex items-center gap-2 rounded-md border px-4 py-2 text-sm opacity-60"
        >
          <Lock className="h-4 w-4" />
          Em breve
        </button>
      </div>
    </div>
  );
}
