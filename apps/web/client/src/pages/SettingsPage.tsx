import React, { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
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
  Coins
} from "lucide-react";

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.nexo.settings.get.useQuery();
  const updateSettingsMutation = trpc.nexo.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Configurações atualizadas com sucesso!");
      utils.nexo.settings.get.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    }
  });

  const [formData, setFormData] = useState({
    name: "",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
  });

  useEffect(() => {
    if (settingsQuery.data) {
      const data = (settingsQuery.data as any)?.data || settingsQuery.data;
      setFormData({
        name: data.name || "",
        timezone: data.timezone || "America/Sao_Paulo",
        currency: data.currency || "BRL",
      });
    }
  }, [settingsQuery.data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (settingsQuery.isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const settingsData = (settingsQuery.data as any)?.data || settingsQuery.data;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6" /> Configurações
          </h2>
          <p className="text-muted-foreground">
            Gerencie as informações da sua organização e preferências do sistema.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm dark:border-zinc-800">
            <div className="flex items-center gap-2 border-b pb-4 mb-4 dark:border-zinc-800">
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
                <label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" /> Fuso Horário
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
                <label className="text-sm font-medium flex items-center gap-2">
                  <Coins className="h-4 w-4 text-muted-foreground" /> Moeda Padrão
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
                <label className="text-sm font-medium">Slug (Identificador Único)</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    disabled
                    value={settingsData?.slug || ""}
                    className="w-full rounded-md border bg-zinc-50 dark:bg-zinc-900/50 pl-10 pr-3 py-2 text-sm text-muted-foreground cursor-not-allowed dark:border-zinc-800"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">O slug não pode ser alterado após a criação.</p>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={updateSettingsMutation.isLoading}
                className="flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
              >
                {updateSettingsMutation.isLoading ? (
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
            <div className="flex items-center gap-2 border-b pb-4 mb-4 dark:border-zinc-800">
              <ShieldCheck className="h-5 w-5 text-orange-500" />
              <h3 className="text-lg font-semibold">Segurança</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Configurações de autenticação e permissões de acesso.
            </p>
            <button className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              Alterar Senha Master
            </button>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm dark:border-zinc-800">
            <div className="flex items-center gap-2 border-b pb-4 mb-4 dark:border-zinc-800">
              <CreditCard className="h-5 w-5 text-orange-500" />
              <h3 className="text-lg font-semibold">Plano e Assinatura</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Plano Atual:</span>
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                  {settingsData?.currentPlan || "Básico"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Membros:</span>
                <span className="text-sm">{settingsData?.membersCount || 0}</span>
              </div>
              <button className="w-full rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
                Gerenciar Assinatura
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
