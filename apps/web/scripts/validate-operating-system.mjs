import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pages = [
  "client/src/pages/CustomersPage.tsx",
  "client/src/pages/AppointmentsPage.tsx",
  "client/src/pages/ServiceOrdersPage.tsx",
  "client/src/pages/FinancesPage.tsx",
  "client/src/pages/SettingsPage.tsx",
  "client/src/pages/GovernancePage.tsx",
  "client/src/pages/PeoplePage.tsx",
  "client/src/pages/TimelinePage.tsx",
  "client/src/pages/BillingPage.tsx",
];

const errors = [];

const forbiddenClasses = [
  "bg-zinc-900",
  "bg-slate-900",
  "bg-black",
  "dark:bg-black",
  "dark:bg-zinc-900",
  "dark:bg-slate-900",
];

const styleScopeFiles = [
  ...pages,
  "client/src/pages/ExecutiveDashboard.tsx",
  "client/src/pages/WhatsAppPage.tsx",
  "client/src/components/ModalFlowShell.tsx",
  "client/src/components/CreateCustomerModal.tsx",
  "client/src/components/CreateAppointmentModal.tsx",
  "client/src/components/CreateServiceOrderModal.tsx",
];
const statusScopePages = [
  "client/src/pages/AppointmentsPage.tsx",
  "client/src/pages/ServiceOrdersPage.tsx",
  "client/src/pages/FinancesPage.tsx",
];
const forbiddenOperationalVisualPatterns = ["shadow-", "ring-", "backdrop-", "blur-"];
const operationalVisualScopeFiles = [
  "client/src/pages/ExecutiveDashboard.tsx",
  "client/src/pages/CustomersPage.tsx",
  "client/src/pages/AppointmentsPage.tsx",
  "client/src/pages/ServiceOrdersPage.tsx",
  "client/src/pages/FinancesPage.tsx",
  "client/src/pages/WhatsAppPage.tsx",
  "client/src/pages/TimelinePage.tsx",
];

for (const page of pages) {
  const source = readFileSync(join(root, page), "utf8");

  if (/\bPageHero\b/.test(source)) {
    errors.push(`${page}: uso legado de PageHero detectado.`);
  }

  if (!/\bPageWrapper\b/.test(source)) {
    errors.push(`${page}: PageWrapper obrigatório não encontrado.`);
  }

  const hasLegacyActionBar = /\bActionBarWrapper\b/.test(source);
  const hasNexoActionContract =
    /\bOperationalTopCard\b/.test(source) || /\bNexoActionGroup\b/.test(source);
  if (!hasLegacyActionBar && !hasNexoActionContract) {
    errors.push(
      `${page}: contrato de ações ausente (esperado ActionBarWrapper legado ou OperationalTopCard/NexoActionGroup do Nexo).`
    );
  }

  if (/from\s+["']@\/components\/ui\/table["']/.test(source)) {
    errors.push(
      `${page}: import direto de tabela legado detectado (@/components/ui/table).`
    );
  }

  if (/\bDataTable\b/.test(source) && !/\bDataTableWrapper\b/.test(source)) {
    errors.push(
      `${page}: DataTableWrapper obrigatório para renderização tabular.`
    );
  }

  if (statusScopePages.includes(page)) {
    if (/severity:\s*["']attention["']/.test(source)) {
      errors.push(
        `${page}: severidade "attention" é proibida; use pending/overdue/critical/healthy.`
      );
    }

    const hasOperationalSeverityReference =
      /OperationalSeverity/.test(source) ||
      /getOperationalSeverity/.test(source);
    if (!hasOperationalSeverityReference) {
      errors.push(
        `${page}: severidade operacional padronizada não encontrada.`
      );
    }

    const hasPrimaryButtonInActionBar = /primaryAction=\{\(\s*<Button\b/.test(
      source
    );
    if (hasPrimaryButtonInActionBar) {
      errors.push(
        `${page}: botão primário em ActionBar deve usar ActionFeedbackButton.`
      );
    }
  }
}

for (const file of styleScopeFiles) {
  const source = readFileSync(join(root, file), "utf8");
  for (const forbidden of forbiddenClasses) {
    if (source.includes(forbidden)) {
      errors.push(
        `${file}: classe proibida detectada (${forbidden}). Use tokens do app.`
      );
    }
  }

  if (operationalVisualScopeFiles.includes(file)) {
    for (const pattern of forbiddenOperationalVisualPatterns) {
      if (source.includes(pattern)) {
        errors.push(
          `${file}: padrão visual proibido detectado (${pattern}) para elementos operacionais.`
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error("\n❌ Validação Operating System falhou:\n");
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log("✅ Validação Operating System concluída sem inconsistências.");
