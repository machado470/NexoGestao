import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeObjectPayload } from "@/lib/query-helpers";
import { PageHero, PageShell, SurfaceSection } from "@/components/PagePattern";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, Settings2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const isInitialLoading = canLoad && query.isLoading && !hasNormalizedSettings;
  const shouldBlockForError = hasError && !hasNormalizedSettings;

  const mutation = trpc.nexo.settings.update.useMutation({
    onSuccess: async (res) => {
      const normalized = sanitizeSettings(res);

      if (normalized) {
        setForm(buildFormFromSettings(normalized));
      }

      toast.success("Configurações atualizadas");
      await utils.nexo.settings.get.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const submitForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

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
      <PageShell>
        <PageHero eyebrow="Configurações" title="Configurações" description="Validando sessão atual." />
        <SurfaceSection className="flex min-h-[180px] items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando sessão...
        </SurfaceSection>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageShell>
        <PageHero eyebrow="Configurações" title="Configurações" description="Sua sessão não está ativa." />
      </PageShell>
    );
  }

  if (isInitialLoading) {
    return (
      <PageShell>
        <PageHero eyebrow="Configurações" title="Configurações" description="Carregando dados da organização." />
        <SurfaceSection className="flex min-h-[180px] items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparando configurações...
        </SurfaceSection>
      </PageShell>
    );
  }

  if (shouldBlockForError) {
    return (
      <PageShell>
        <PageHero eyebrow="Configurações" title="Configurações" description="Não foi possível carregar as configurações." />
        <SurfaceSection className="border-red-200 text-red-700 dark:border-red-900/40 dark:text-red-300">
          {query.error?.message || "Erro ao carregar configurações"}
        </SurfaceSection>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Configurações"
        title="Configurações"
        description="Ajustes institucionais com padrão visual unificado do dashboard executivo."
      />

      {!hasData ? (
        <SurfaceSection>
          <EmptyState
            icon={<Settings2 className="h-7 w-7" />}
            title="Configurações prontas para personalização"
            description="Defina nome, timezone e moeda da organização para padronizar o comportamento operacional."
            action={{
              label: "Recarregar",
              onClick: () => void query.refetch(),
            }}
          />
        </SurfaceSection>
      ) : null}

      {hasError && !shouldBlockForError ? (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          {query.error?.message ||
            "Houve um problema ao recarregar as configurações."}
        </div>
      ) : null}

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

          <Button disabled={!hasChanges || mutation.isPending} type="submit">
            {mutation.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </SurfaceSection>
    </PageShell>
  );
}
