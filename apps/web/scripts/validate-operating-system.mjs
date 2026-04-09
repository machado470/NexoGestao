import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const pages = [
  'client/src/pages/CustomersPage.tsx',
  'client/src/pages/AppointmentsPage.tsx',
  'client/src/pages/ServiceOrdersPage.tsx',
  'client/src/pages/FinancesPage.tsx',
  'client/src/pages/SettingsPage.tsx',
  'client/src/pages/GovernancePage.tsx',
  'client/src/pages/PeoplePage.tsx',
];

const errors = [];

for (const page of pages) {
  const source = readFileSync(join(root, page), 'utf8');

  if (/\bPageHero\b/.test(source)) {
    errors.push(`${page}: uso legado de PageHero detectado.`);
  }

  if (!/\bPageWrapper\b/.test(source)) {
    errors.push(`${page}: PageWrapper obrigatório não encontrado.`);
  }

  if (!/\bActionBarWrapper\b/.test(source)) {
    errors.push(`${page}: ActionBarWrapper obrigatório não encontrado.`);
  }

  if (/from\s+["']@\/components\/ui\/table["']/.test(source)) {
    errors.push(`${page}: import direto de tabela legado detectado (@/components/ui/table).`);
  }

  if (/\bDataTable\b/.test(source) && !/\bDataTableWrapper\b/.test(source)) {
    errors.push(`${page}: DataTableWrapper obrigatório para renderização tabular.`);
  }
}

if (errors.length > 0) {
  console.error('\n❌ Validação Operating System falhou:\n');
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log('✅ Validação Operating System concluída sem inconsistências.');
