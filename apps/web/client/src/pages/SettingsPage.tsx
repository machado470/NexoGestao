import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getQueryUiState, normalizeObjectPayload } from "@/lib/query-helpers";
import { SurfaceSection } from "@/components/PagePattern";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, Settings2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { ActionBarWrapper, PageWrapper } from "@/components/operating-system/Wrappers";

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

  const id = String(raw.id ?? "").trim();
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
  const canLoad = isAuthenticated;
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
        <SurfaceSection className="flex min-h-[180px] items-center justify-center gap-2 text-sm text-[var(--text-muted)] dark:text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando sessão...
        </SurfaceSection>
      </PageWrapper>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageWrapper title="Configurações" subtitle="Sua sessão não está ativa.">
        <SurfaceSection className="text-sm text-[var(--text-muted)] dark:text-[var(--text-muted)]">Faça login para acessar configurações.</SurfaceSection>
      </PageWrapper>
    );
  }

  if (queryState.isInitialLoading) {
    return (
      <PageWrapper title="Configurações" subtitle="Carregando dados da organização.">
        <SurfaceSection className="flex min-h-[180px] items-center justify-center gap-2 text-sm text-[var(--text-muted)] dark:text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparando configurações...
        </SurfaceSection>
      </PageWrapper>
    );
  }

  if (queryState.shouldBlockForError) {
    return (
      <PageWrapper title="Configurações" subtitle="Não foi possível carregar as configurações.">
        <SurfaceSection className="border-red-200 text-red-700 dark:border-red-900/40 dark:text-red-300">
          {query.error?.message || "Erro ao carregar configurações"}
        </SurfaceSection>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="Configurações"
      subtitle="Fechamento do fluxo oficial com padronização institucional: nome, timezone e moeda da operação."
    >
      <ActionBarWrapper
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

      {!hasData ? (
        <SurfaceSection>
          <EmptyState
            icon={<Settings2 className="h-7 w-7" />}
            title="Configurações prontas para personalização"
            description="Defina identidade e padrão institucional para consolidar operação, financeiro e governança em uma mesma base."
            action={{
              label: "Atualizar configurações",
              onClick: () => void query.refetch(),
            }}
          />
        </SurfaceSection>
      ) : null}

      {queryState.hasBackgroundUpdate ? (
        <SurfaceSection className="border-blue-500/30 bg-blue-500/10 text-sm text-blue-200">
          Atualizando configurações em segundo plano...
        </SurfaceSection>
      ) : null}

      {hasError && !queryState.shouldBlockForError ? (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          {query.error?.message ||
            "Houve um problema ao recarregar as configurações."}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="nexo-kpi-card p-4"><p className="text-xs text-[var(--text-muted)]">Organização</p><p className="text-lg font-semibold">{settings?.name || "—"}</p></div>
        <div className="nexo-kpi-card p-4"><p className="text-xs text-[var(--text-muted)]">Timezone</p><p className="text-lg font-semibold">{form.timezone}</p></div>
        <div className="nexo-kpi-card p-4"><p className="text-xs text-[var(--text-muted)]">Moeda</p><p className="text-lg font-semibold">{form.currency}</p></div>
        <div className="nexo-kpi-card p-4"><p className="text-xs text-[var(--text-muted)]">Status</p><p className="text-lg font-semibold">{hasChanges ? "Com alterações" : "Sincronizado"}</p></div>
      </div>

      <SurfaceSection>
        <p className="text-sm text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
          Bloco analítico: padronização institucional consistente reduz erro de operação, relatórios e faturamento.
        </p>
      </SurfaceSection>

      <SurfaceSection className="space-y-2">
        <h2 className="font-semibold">Fila operacional de configuração</h2>
        <div className="nexo-subtle-surface p-3 text-sm">1. Validar nome institucional.</div>
        <div className="nexo-subtle-surface p-3 text-sm">2. Confirmar timezone oficial da operação.</div>
        <div className="nexo-subtle-surface p-3 text-sm">3. Validar moeda padrão para financeiro e governança.</div>
      </SurfaceSection>

      <SurfaceSection>
        <form className="space-y-4" onSubmit={submitForm}>
          <div className="space-y-2">
            <Label htmlFor="settings-name">Nome da organização</Label>
            <Input
              id="settings-name"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Nome da organização"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-timezone">Timezone</Label>
            <Input
              id="settings-timezone"
              value={form.timezone}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, timezone: e.target.value }))
              }
              placeholder="America/Sao_Paulo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-currency">Moeda padrão</Label>
            <Input
              id="settings-currency"
              value={form.currency}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, currency: e.target.value }))
              }
              placeholder="BRL"
            />
          </div>

          <ActionFeedbackButton
            state={mutation.isPending ? "loading" : "idle"}
            idleLabel="Salvar alterações"
            loadingLabel="Salvando..."
            onClick={handleSave}
          />
        </form>
      </SurfaceSection>
    </PageWrapper>
  );
}
