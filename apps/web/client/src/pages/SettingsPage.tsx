import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getQueryUiState, normalizeObjectPayload } from "@/lib/query-helpers";
import { Loader2 } from "lucide-react";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppEmptyState,
  AppErrorState,
  AppField,
  AppForm,
  AppFormActions,
  AppInput,
  AppPageHeader,
  AppPageShell,
  AppSectionCard,
  AppStatusBadge,
  AppToolbar,
} from "@/components/app-system";

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

function sanitizeSettings(payload: unknown): SettingsResponse | null {
  const raw = normalizeObjectPayload<Partial<SettingsResponse>>(payload);
  if (!raw || typeof raw !== "object") return null;

  const id = String(raw.id ?? raw.slug ?? "settings").trim();
  if (!id) return null;

  return {
    id,
    name: String(raw.name ?? ""),
    slug: String(raw.slug ?? ""),
    timezone: String(raw.timezone ?? "America/Sao_Paulo"),
    currency: String(raw.currency ?? "BRL"),
  };
}

function buildFormFromSettings(
  settings: SettingsResponse | null
): SettingsFormData {
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

  const settings = useMemo(() => sanitizeSettings(query.data), [query.data]);
  const initialForm = useMemo(() => buildFormFromSettings(settings), [settings]);

  const [form, setForm] = useState<SettingsFormData>(DEFAULT_FORM);

  useEffect(() => {
    if (settings) {
      setForm(buildFormFromSettings(settings));
    }
  }, [settings]);

  const hasData = !!settings;
  const hasNormalizedSettings = query.data !== undefined;
  const hasChanges = useMemo(
    () => !formsAreEqual(form, initialForm),
    [form, initialForm]
  );

  const hasError = query.isError;
  const queryState = getQueryUiState([query], hasNormalizedSettings);

  const mutation = trpc.nexo.settings.update.useMutation({
    onMutate: async (variables) => {
      const previous = utils.nexo.settings.get.getData(undefined);
      utils.nexo.settings.get.setData(undefined, (old: any) => {
        const raw = (old as any)?.data ? (old as any).data : old;
        if (!raw || typeof raw !== "object") return old;
        const next = { ...raw, ...variables };
        if ((old as any)?.data) {
          return { ...(old as any), data: next };
        }
        return next;
      });
      return { previous };
    },
    onSuccess: async (res) => {
      const normalized = sanitizeSettings(res);

      if (normalized) {
        setForm(buildFormFromSettings(normalized));
        utils.nexo.settings.get.setData(undefined, normalized);
      }

      toast.success("Configurações atualizadas");
      void utils.nexo.settings.get.invalidate();
    },
    onError: (err, _variables, context) => {
      if (context?.previous) {
        utils.nexo.settings.get.setData(undefined, context.previous as any);
      }
      toast.error(err.message);
    },
  });

  const submitForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSave();
  };

  const handleSave = () => {
    const payload = {
      name: form.name.trim(),
      timezone: form.timezone.trim(),
      currency: form.currency.trim().toUpperCase(),
    };

    if (!payload.name) {
      toast.error("Informe o nome da organização.");
      return;
    }

    if (!payload.timezone) {
      toast.error("Informe a timezone da organização.");
      return;
    }

    if (!payload.currency) {
      toast.error("Informe a moeda padrão.");
      return;
    }

    mutation.mutate(payload);
  };

  if (isInitializing) {
    return (
      <PageWrapper title="Configurações" subtitle="Validando sessão atual.">
        <AppSectionCard className="flex min-h-[180px] items-center justify-center gap-2 text-sm text-[var(--text-muted)] dark:text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando sessão...
        </AppSectionCard>
      </PageWrapper>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageWrapper title="Configurações" subtitle="Sua sessão não está ativa.">
        <AppSectionCard className="text-sm text-[var(--text-muted)] dark:text-[var(--text-muted)]">
          Faça login para acessar configurações.
        </AppSectionCard>
      </PageWrapper>
    );
  }

  if (queryState.isInitialLoading) {
    return (
      <PageWrapper title="Configurações" subtitle="Carregando dados da organização.">
        <AppSectionCard className="flex min-h-[180px] items-center justify-center gap-2 text-sm text-[var(--text-muted)] dark:text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparando configurações...
        </AppSectionCard>
      </PageWrapper>
    );
  }

  if (queryState.shouldBlockForError) {
    return (
      <PageWrapper title="Configurações" subtitle="Não foi possível carregar as configurações.">
        <AppSectionCard className="border-red-200 text-red-700 dark:border-red-900/40 dark:text-red-300">
          {query.error?.message || "Erro ao carregar configurações"}
        </AppSectionCard>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="Configurações"
      subtitle="Parâmetros institucionais que sustentam operação, financeiro e governança."
    >
      <AppPageShell>
        <OperationalTopCard
          contextLabel="Direção institucional"
          title={
            hasChanges
              ? "Existem alterações pendentes de sincronização"
              : "Configurações sincronizadas"
          }
          description="Padronize nome, timezone e moeda em um único bloco para sustentar operação, financeiro e governança."
          chips={(
            <>
              <span className="rounded-full border px-3 py-1 text-xs text-[var(--text-secondary)]">Timezone: {form.timezone || "—"}</span>
              <span className="rounded-full border px-3 py-1 text-xs text-[var(--text-secondary)]">Moeda: {form.currency || "—"}</span>
            </>
          )}
          secondaryActions={(
            <ActionFeedbackButton
              state={query.isFetching ? "loading" : "idle"}
              idleLabel="Atualizar leitura"
              loadingLabel="Atualizando..."
              variant="outline"
              onClick={() => void query.refetch()}
            />
          )}
        />

        <AppPageHeader>
          <AppToolbar>
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              Status atual:
              <AppStatusBadge
                tone={hasChanges ? "warning" : "success"}
                label={hasChanges ? "Com alterações" : "Sincronizado"}
              />
            </div>
          </AppToolbar>
        </AppPageHeader>

        {!hasData ? (
          <AppEmptyState
            title="Configurações prontas para personalização"
            description="Defina identidade e padrão institucional para consolidar operação, financeiro e governança em uma mesma base."
            action={(
              <ActionFeedbackButton
                state={query.isFetching ? "loading" : "idle"}
                idleLabel="Atualizar configurações"
                loadingLabel="Atualizando..."
                onClick={() => void query.refetch()}
              />
            )}
          />
        ) : null}

        {queryState.hasBackgroundUpdate ? (
          <AppSectionCard className="nexo-info-banner text-sm">
            Atualizando configurações em segundo plano...
          </AppSectionCard>
        ) : null}

        {hasError && !queryState.shouldBlockForError ? (
          <AppErrorState
            message={
              query.error?.message ||
              "Houve um problema ao recarregar as configurações."
            }
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <AppSectionCard className="p-4"><p className="text-xs text-[var(--text-muted)]">Organização</p><p className="text-lg font-semibold">{settings?.name || "—"}</p></AppSectionCard>
          <AppSectionCard className="p-4"><p className="text-xs text-[var(--text-muted)]">Timezone</p><p className="text-lg font-semibold">{form.timezone}</p></AppSectionCard>
          <AppSectionCard className="p-4"><p className="text-xs text-[var(--text-muted)]">Moeda</p><p className="text-lg font-semibold">{form.currency}</p></AppSectionCard>
          <AppSectionCard className="p-4"><p className="text-xs text-[var(--text-muted)]">Status</p><p className="text-lg font-semibold">{hasChanges ? "Com alterações" : "Sincronizado"}</p></AppSectionCard>
        </div>

        <AppSectionCard className="space-y-2">
          <h2 className="font-semibold">Checklist de configuração</h2>
          <div className="nexo-subtle-surface p-3 text-sm">1. Validar nome institucional.</div>
          <div className="nexo-subtle-surface p-3 text-sm">2. Confirmar timezone oficial da operação.</div>
          <div className="nexo-subtle-surface p-3 text-sm">3. Validar moeda padrão para financeiro e governança.</div>
        </AppSectionCard>

        <AppSectionCard>
          <AppForm onSubmit={submitForm}>
            <AppField label="Nome da organização" htmlFor="settings-name">
              <AppInput
                id="settings-name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Nome da organização"
              />
            </AppField>

            <AppField label="Timezone" htmlFor="settings-timezone">
              <AppInput
                id="settings-timezone"
                value={form.timezone}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, timezone: e.target.value }))
                }
                placeholder="America/Sao_Paulo"
              />
            </AppField>

            <AppField label="Moeda padrão" htmlFor="settings-currency">
              <AppInput
                id="settings-currency"
                value={form.currency}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, currency: e.target.value }))
                }
                placeholder="BRL"
              />
            </AppField>

            <AppFormActions>
              <ActionFeedbackButton
                state={mutation.isPending ? "loading" : "idle"}
                idleLabel="Salvar alterações"
                loadingLabel="Salvando..."
                onClick={handleSave}
              />
            </AppFormActions>
          </AppForm>
        </AppSectionCard>
      </AppPageShell>
    </PageWrapper>
  );
}
