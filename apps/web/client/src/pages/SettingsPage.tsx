import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeObjectPayload } from "@/lib/query-helpers";

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
  const [didHydrateFromServer, setDidHydrateFromServer] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm(buildFormFromSettings(settings));
      setDidHydrateFromServer(true);
      return;
    }

    if (!query.isLoading && query.data !== undefined) {
      setDidHydrateFromServer(true);
    }
  }, [settings, query.isLoading, query.data]);

  const hasData = !!settings;
  const hasChanges = useMemo(
    () => !formsAreEqual(form, initialForm),
    [form, initialForm]
  );

  const hasError = query.isError;
  const isInitialLoading =
    canLoad && query.isLoading && !hasData && !didHydrateFromServer;
  const shouldBlockForError = hasError && !hasData;

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

  if (isInitializing) {
    return <div className="p-6">Carregando sessão...</div>;
  }

  if (!isAuthenticated) {
    return <div className="p-6">Faça login</div>;
  }

  if (isInitialLoading) {
    return <div className="p-6">Carregando...</div>;
  }

  if (shouldBlockForError) {
    return (
      <div className="p-6 text-red-500">
        {query.error?.message || "Erro ao carregar configurações"}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      {!hasData ? (
        <div className="rounded border p-4 text-sm opacity-70">
          Nenhuma configuração carregada ainda. Você já pode preencher e salvar.
        </div>
      ) : null}

      {hasError && !shouldBlockForError ? (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          {query.error?.message ||
            "Houve um problema ao recarregar as configurações."}
        </div>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(form);
        }}
      >
        <input
          className="w-full rounded border p-2"
          value={form.name}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="Nome da organização"
        />

        <input
          className="w-full rounded border p-2"
          value={form.timezone}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, timezone: e.target.value }))
          }
          placeholder="Timezone"
        />

        <input
          className="w-full rounded border p-2"
          value={form.currency}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, currency: e.target.value }))
          }
          placeholder="Moeda"
        />

        <button
          className="rounded bg-orange-500 px-4 py-2 text-black disabled:opacity-50"
          disabled={!hasChanges || mutation.isPending}
          type="submit"
        >
          {mutation.isPending ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
}
