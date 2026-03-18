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
  CreditCard,
  Clock,
  Coins,
  AlertTriangle,
  RefreshCw,
  Lock,
  Users,
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
  currentPlan: string;
  membersCount: number;
};

const DEFAULT_FORM: SettingsFormData = {
  name: "",
  timezone: "America/Sao_Paulo",
  currency: "BRL",
};

function normalizeSettingsPayload(payload: unknown): SettingsResponse | null {
  const raw = (payload as { data?: unknown } | null | undefined)?.data ?? payload;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<SettingsResponse>;

  return {
    id: typeof candidate.id === "string" ? candidate.id : "",
    name: typeof candidate.name === "string" ? candidate.name : "",
    slug: typeof candidate.slug === "string" ? candidate.slug : "",
    timezone:
      typeof candidate.timezone === "string"
        ? candidate.timezone
        : "America/Sao_Paulo",
    currency: typeof candidate.currency === "string" ? candidate.currency : "BRL",
    currentPlan:
      typeof candidate.currentPlan === "string" && candidate.currentPlan.trim()
        ? candidate.currentPlan
        : "Nenhum",
    membersCount:
      typeof candidate.membersCount === "number" && Number.isFinite(candidate.membersCount)
        ? candidate.membersCount
        : 0,
  };
}

function buildFormFromSettings(settings: SettingsResponse | null): SettingsFormData {
  if (!settings) {
    return DEFAULT_FORM;
  }

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
  const canLoadSettings = isAuthenticated && !isInitializing;

  const utils = trpc.useUtils();

  const settingsQuery = trpc.nexo.settings.get.useQuery(undefined, {
    enabled: canLoadSettings,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const settingsData = useMemo(() => {
    return normalizeSettingsPayload(settingsQuery.data);
  }, [settingsQuery.data]);

  const initialFormData = useMemo(() => {
    return buildFormFromSettings(settingsData);
  }, [settingsData]);

  const [formData, setFormData] = useState<SettingsFormData>(DEFAULT_FORM);

  useEffect(() => {
    setFormData(initialFormData);
  }, [initialFormData]);

  const hasChanges = useMemo(() => {
    return !formsAreEqual(formData, initialFormData);
  }, [formData, initialFormData]);

  const updateSettingsMutation = trpc.nexo.settings.update.useMutation({
    onSuccess: async (response) => {
      const normalized = normalizeSettingsPayload(response);

      if (normalized) {
        setFormData(buildFormFromSettings(normalized));
      }

      toast.success("Configurações atualizadas com sucesso.");
      await utils.nexo.settings.get.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = formData.name.trim();

    if (!trimmedName) {
      toast.error("Informe o nome da empresa.");
      return;
    }

    if (!hasChanges) {
      toast.message("Nenhuma alteração para salvar.");
      return;
    }

    updateSettingsMutation.mutate({
      name: trimmedName,
      timezone: formData.timezone,
      currency: formData.currency,
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (isInitializing) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-xl border p-4 text-sm text-zinc-500 dark:border-zinc-800">
          Faça login para visualizar configurações.
        </div>
      </div>
    );
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (settingsQuery.isError || !settingsData) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Erro ao carregar configurações
          </div>

          <p className="mt-2 text-sm">
            Não foi possível carregar os dados da organização agora.
          </p>

          <button
            type="button"
            onClick={() => void settingsQuery.refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-950/40"
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Settings className="h-6 w-6" />
            Configurações
          </h2>
          <p className="text-muted-foreground">
            Gerencie os dados principais da organização e as preferências operacionais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
              hasChanges
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
            }`}
          >
            {hasChanges ? "Alterações pendentes" : "Tudo salvo"}
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-2 space-y-6">
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-xl border bg-card p-6 shadow-sm dark:border-zinc-800"
          >
            <div className="mb-4 flex items-center gap-2 border-b pb-4 dark:border-zinc-800">
              <Building2 className="h-5 w-5 text-orange-500" />
              <h3 className="text-lg font-semibold">Perfil da Organização</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium">Nome da Empresa</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
                  placeholder="Ex: Minha Empresa LTDA"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Fuso Horário
                </label>
                <select
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
                >
                  <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                  <option value="America/Manaus">Manaus (GMT-4)</option>
                  <option value="America/New_York">New York (GMT-5)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  Moeda Padrão
                </label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
                >
                  <option value="BRL">Real (R$)</option>
                  <option value="USD">Dólar (US$)</option>
                  <option value="EUR">Euro (€)</option>
                </select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium">
                  Slug (Identificador Único)
                </label>

                <div className="relative">
                  <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    disabled
                    value={settingsData.slug}
                    className="w-full cursor-not-allowed rounded-md border bg-zinc-50 py-2 pl-10 pr-3 text-sm text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900/50"
                  />
                </div>

                <p className="text-[10px] text-muted-foreground">
                  O slug é definido na criação da organização e não pode ser alterado.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                As alterações afetam o contexto principal da organização.
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(initialFormData)}
                  disabled={!hasChanges || updateSettingsMutation.isPending}
                  className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  Descartar
                </button>

                <button
                  type="submit"
                  disabled={
                    updateSettingsMutation.isPending ||
                    !formData.name.trim() ||
                    !hasChanges
                  }
                  className="flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updateSettingsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar Alterações
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6 shadow-sm dark:border-zinc-800">
            <div className="mb-4 flex items-center gap-2 border-b pb-4 dark:border-zinc-800">
              <ShieldCheck className="h-5 w-5 text-orange-500" />
              <h3 className="text-lg font-semibold">Segurança</h3>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              Gestão avançada de credenciais ainda não está exposta por esta tela.
            </p>

            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-500 opacity-70 dark:border-zinc-800 dark:text-zinc-400"
            >
              <Lock className="h-4 w-4" />
              Em breve
            </button>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm dark:border-zinc-800">
            <div className="mb-4 flex items-center gap-2 border-b pb-4 dark:border-zinc-800">
              <CreditCard className="h-5 w-5 text-orange-500" />
              <h3 className="text-lg font-semibold">Plano e Assinatura</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Plano Atual</span>
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                  {settingsData.currentPlan}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Membros
                </span>
                <span className="text-sm">{settingsData.membersCount}</span>
              </div>

              <button
                type="button"
                disabled
                className="w-full cursor-not-allowed rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 opacity-70 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Gestão comercial em breve
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
