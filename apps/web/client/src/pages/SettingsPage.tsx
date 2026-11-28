import { BaseModal } from "@/components/app-modal-system";
import { formatOrganizationDate, formatRecordedMoney } from "@/lib/organization-locale";
import { AccountNavigation } from "@/components/AccountNavigation";
import { MobileModuleHeader } from "@/components/MobileModuleHeader";
import { useFormDiscardGuard } from "@/hooks/useFormDiscardGuard";
import { FormEvent, useEffect, useReducer, useState } from "react";
import { Building2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  AppField,
  AppFieldGroup,
  AppForm,
  AppFormActions,
  AppInput,
  AppSelect,
} from "@/components/app-system";
import {
  AppOperationalHeader,
  AppPageErrorState,
  AppPageLoadingState,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { OrganizationAccessSection } from "@/components/OrganizationAccessSection";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeObjectPayload } from "@/lib/query-helpers";
import { trpc } from "@/lib/trpc";
import {
  hasSettingsChanges,
  initialSettingsDraft,
  settingsDraftReducer,
} from "@/lib/settings-draft";
import { isValidSettingsTimezone } from "@/lib/settings-validation";

type Currency = "BRL" | "USD" | "EUR";

type OrganizationSettings = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: Currency;
};

const EXAMPLE_VISIT = "2027-01-12T13:00:00Z";
const EXAMPLE_AMOUNT_CENTS = 12345;

const currencyOptions = [
  { value: "BRL", label: "Real brasileiro (BRL)" },
  { value: "USD", label: "Dólar americano (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
];

export default function SettingsPage() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const settingsQuery = trpc.settings.get.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const settings = normalizeObjectPayload<OrganizationSettings>(
    settingsQuery.data
  );
  const [draft, dispatch] = useReducer(
    settingsDraftReducer,
    initialSettingsDraft
  );
  const [reviewOpen, setReviewOpen] = useState(false);
  const { name, timezone, currency } = draft.values;

  useEffect(() => {
    if (settings) dispatch({ type: "received", values: settings });
  }, [settings?.id, settings?.currency, settings?.name, settings?.timezone]);

  const updateMutation = trpc.settings.update.useMutation({
    onMutate: () => utils.settings.get.cancel(),
    onSuccess: data => {
      const confirmed = normalizeObjectPayload<OrganizationSettings>(data);
      if (!confirmed) return;
      utils.settings.get.setData(undefined, data);
      dispatch({ type: "confirmed", values: confirmed });
      void utils.settings.displayPreferences.invalidate();
      setReviewOpen(false);
      toast.success("Configurações da organização salvas.");
    },
    onError: error => {
      toast.error(error.message || "Não foi possível salvar as configurações.");
    },
  });

  const hasChanges = hasSettingsChanges(draft);
  const timezoneValid = isValidSettingsTimezone(timezone);
  const hasRequiredValues = name.trim() !== "" && timezoneValid;

  const saved = draft.baseline;
  const timezoneChanged = Boolean(saved && timezone.trim() !== saved.timezone);
  const currencyChanged = Boolean(saved && currency !== saved.currency);
  const preferenceChanges = saved ? [
    ...(timezoneChanged ? [
      `Fuso horário de ${saved.timezone} para ${timezone.trim()}. A mesma visita de exemplo aparece como ${formatOrganizationDate(EXAMPLE_VISIT, saved.timezone)} no fuso atual e ${formatOrganizationDate(EXAMPLE_VISIT, timezone.trim())} no novo. Os horários gravados das visitas existentes e o fuso das séries já criadas são preservados.`,
    ] : []),
    ...(currencyChanged ? [
      `Moeda de referência de ${saved.currency} para ${currency}. Exemplo de formato no novo padrão: ${formatRecordedMoney(EXAMPLE_AMOUNT_CENTS, currency)}. As cobranças existentes mantêm a moeda e o valor registrados.`,
    ] : []),
  ] : [];

  const saveSettings = () => {
    if (!hasChanges || !hasRequiredValues || updateMutation.isPending) return;
    setReviewOpen(false);
    updateMutation.mutate({
      name: name.trim(),
      timezone: timezone.trim(),
      currency,
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasChanges || !hasRequiredValues || updateMutation.isPending) return;
    if (timezoneChanged || currencyChanged) {
      setReviewOpen(true);
      return;
    }
    saveSettings();
  };

  const resetForm = () => {
    if (!settings) return;
    dispatch({ type: "discard" });
    updateMutation.reset();
  };

  const discardGuard = useFormDiscardGuard({
    open: true,
    dirty: hasChanges,
    blocked: updateMutation.isPending,
    onDiscard: resetForm,
    guardNavigation: true,
  });

  return (
    <AppPageShell className="operational-mobile-page mobile-module-page account-page gap-4 p-3 md:p-5">
      {discardGuard.confirmation}
      <BaseModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        title="Confirmar preferências da empresa?"
        size="lg"
        intent="confirm"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setReviewOpen(false)}>Voltar para edição</Button>
            <Button type="button" onClick={saveSettings}>Salvar preferências</Button>
          </>
        }
      >
        {preferenceChanges.map(change => <p key={change} className="mb-3 text-sm">{change}</p>)}
      </BaseModal>
      <MobileModuleHeader
        title="Configurações"
        description="Preferências da sua organização."
        context={hasChanges ? "Alterações não salvas" : settings?.name}
      />
      <div className="hidden md:block">
        <AppOperationalHeader
          title="Configurações"
          description="Defina os dados que orientam o funcionamento desta organização."
          primaryAction={
            <Button
              type="submit"
              form="organization-settings-form"
              disabled={
                !hasChanges || !hasRequiredValues || updateMutation.isPending
              }
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          }
          secondaryActions={
            <Button
              type="button"
              variant="outline"
              disabled={settingsQuery.isFetching || updateMutation.isPending}
              onClick={() => void settingsQuery.refetch()}
            >
              <RefreshCw className="mr-2 size-4" aria-hidden="true" />
              Atualizar
            </Button>
          }
          contextChips={
            settings ? (
              <>
                <AppStatusBadge label={settings.name} />
                {hasChanges ? (
                  <AppStatusBadge label="Alterações não salvas" />
                ) : null}
              </>
            ) : undefined
          }
        />
      </div>

      <AccountNavigation current="/settings" />

      <AppSectionBlock
        title="Organização"
        subtitle="Estas preferências se aplicam a toda a organização."
      >
        {settingsQuery.isError && settings ? (
          <p role="alert" className="mb-4 text-sm text-destructive">
            Não foi possível atualizar as configurações. Suas edições foram
            preservadas.
          </p>
        ) : null}
        {settingsQuery.isLoading ? (
          <AppPageLoadingState
            title="Carregando configurações"
            description="Consultando os valores persistidos da organização."
          />
        ) : settingsQuery.isError && !settings ? (
          <AppPageErrorState
            title="Configurações indisponíveis"
            description="A fonte oficial não respondeu. Nenhum valor padrão foi presumido."
            actionLabel="Tentar novamente"
            onAction={() => void settingsQuery.refetch()}
          />
        ) : !settings ? (
          <AppPageErrorState
            title="Configurações não retornadas"
            description="A consulta terminou sem dados utilizáveis da organização."
            actionLabel="Consultar novamente"
            onAction={() => void settingsQuery.refetch()}
          />
        ) : (
          <AppForm id="organization-settings-form" onSubmit={handleSubmit}>
            <AppFieldGroup>
              <AppField label="Nome da organização" htmlFor="settings-name">
                <AppInput
                  id="settings-name"
                  name="name"
                  autoComplete="organization"
                  value={name}
                  onChange={event => {
                    dispatch({
                      type: "edit",
                      values: { name: event.target.value },
                    });
                    updateMutation.reset();
                  }}
                  aria-invalid={name.trim() === ""}
                  aria-describedby={
                    name.trim() === "" ? "settings-name-error" : undefined
                  }
                  disabled={updateMutation.isPending}
                  required
                />
                {name.trim() === "" ? (
                  <p
                    id="settings-name-error"
                    className="text-xs text-destructive"
                  >
                    Informe o nome da organização.
                  </p>
                ) : null}
              </AppField>

              <AppField
                label="Fuso horário"
                htmlFor="settings-timezone"
                hint="Usado para apresentar datas e horários da operação."
              >
                <AppInput
                  id="settings-timezone"
                  name="timezone"
                  value={timezone}
                  onChange={event => {
                    dispatch({
                      type: "edit",
                      values: { timezone: event.target.value },
                    });
                    updateMutation.reset();
                  }}
                  placeholder="America/Sao_Paulo"
                  aria-invalid={!timezoneValid}
                  aria-describedby={
                    !timezoneValid ? "settings-timezone-error" : undefined
                  }
                  disabled={updateMutation.isPending}
                  required
                />
                {!timezoneValid ? (
                  <p
                    id="settings-timezone-error"
                    className="text-xs text-destructive"
                  >
                    Informe um fuso horário válido, como America/Sao_Paulo ou
                    UTC.
                  </p>
                ) : null}
              </AppField>

              <AppField
                label="Moeda operacional"
                htmlFor="settings-currency"
                hint="Moeda de referência da organização. Cada cobrança mantém sua moeda registrada; esta alteração não converte valores existentes."
              >
                <AppSelect
                  id="settings-currency"
                  value={currency}
                  onValueChange={value => {
                    if (updateMutation.isPending) return;
                    dispatch({
                      type: "edit",
                      values: { currency: value as Currency },
                    });
                    updateMutation.reset();
                  }}
                  options={currencyOptions}
                  ariaLabel="Moeda operacional"
                />
              </AppField>

              <AppField
                label="Identificador da organização"
                htmlFor="settings-slug"
                hint="Informação somente leitura."
              >
                <AppInput
                  id="settings-slug"
                  value={settings.slug}
                  readOnly
                  aria-readonly="true"
                />
              </AppField>
            </AppFieldGroup>

            {updateMutation.isError ? (
              <p role="alert" className="text-sm text-destructive">
                A alteração não foi salva. Revise os dados e tente novamente.
              </p>
            ) : null}
            {updateMutation.isSuccess && !hasChanges ? (
              <p role="status" className="text-sm text-[var(--success)]">
                Configurações salvas e confirmadas pela fonte oficial.
              </p>
            ) : null}

            <AppFormActions className="justify-between border-t border-[var(--border-subtle)] pt-4">
              <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--text-muted)]">
                <Building2 className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{settings.slug}</span>
              </div>
              <div className="account-form-buttons flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={discardGuard.requestClose}
                  disabled={!hasChanges || updateMutation.isPending}
                >
                  Descartar alterações
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !hasChanges ||
                    !hasRequiredValues ||
                    updateMutation.isPending
                  }
                >
                  {updateMutation.isPending
                    ? "Salvando..."
                    : "Salvar alterações"}
                </Button>
              </div>
            </AppFormActions>
          </AppForm>
        )}
      </AppSectionBlock>
      <p className="text-sm text-[var(--text-muted)] md:hidden" role="status">
        {hasChanges
          ? "Suas alterações ainda não foram salvas."
          : "Tudo pronto. Nenhuma alteração pendente."}
      </p>
      <OrganizationAccessSection />
    </AppPageShell>
  );
}
