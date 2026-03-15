import React, { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
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
} from "lucide-react";

type SettingsFormData = {
  name: string;
  timezone: string;
  currency: string;
};

function normalizeSettingsPayload(payload: any) {
  return payload?.data ?? payload ?? null;
}

export default function SettingsPage() {
  const utils = trpc.useUtils();

  const settingsQuery = trpc.nexo.settings.get.useQuery();

  const updateSettingsMutation = trpc.nexo.settings.update.useMutation({
    onSuccess: async () => {
      toast.success("Configurações atualizadas com sucesso.");
      await utils.nexo.settings.get.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const settingsData = useMemo(() => {
    return normalizeSettingsPayload(settingsQuery.data);
  }, [settingsQuery.data]);

  const [formData, setFormData] = useState<SettingsFormData>({
    name: "",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
  });

  useEffect(() => {
    if (!settingsData) return;

    setFormData({
      name: settingsData?.name || "",
      timezone: settingsData?.timezone || "America/Sao_Paulo",
      currency: settingsData?.currency || "BRL",
    });
  }, [settingsData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateSettingsMutation.mutate({
      name: formData.name.trim(),
      timezone: formData.timezone,
      currency: formData.currency,
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (settingsQuery.isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (settingsQuery.isError) {
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
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Settings className="h-6 w-6" />
            Configurações
          </h2>
          <p className="text-muted-foreground">
            Gerencie as informações da sua organização e preferências do sistema.
          </p>
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
                    value={settingsData?.slug || ""}
                    className="w-full cursor-not-allowed rounded-md border bg-zinc-50 py-2 pl-10 pr-3 text-sm text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900/50"
                  />
                </div>

                <p className="text-[10px] text-muted-foreground">
                  O slug não pode ser alterado após a criação.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={
                  updateSettingsMutation.isPending || !formData.name.trim()
                }
                className="flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {updateSettingsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar Alterações
              </button>
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
              Configurações de autenticação e permissões de acesso.
            </p>

            <button
              type="button"
              className="w-full rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
            >
              Alterar Senha Master
            </button>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm dark:border-zinc-800">
            <div className="mb-4 flex items-center gap-2 border-b pb-4 dark:border-zinc-800">
              <CreditCard className="h-5 w-5 text-orange-500" />
              <h3 className="text-lg font-semibold">Plano e Assinatura</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Plano Atual:</span>
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                  {settingsData?.currentPlan || "Básico"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Membros:</span>
                <span className="text-sm">{settingsData?.membersCount || 0}</span>
              </div>

              <button
                type="button"
                className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Gerenciar Assinatura
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
