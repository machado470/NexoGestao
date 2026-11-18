// Local financial form close/navigation audit. No real API writes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const width = Number(process.env.MOBILE_WIDTH || 390);
  const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  page.setDefaultTimeout(15000);
  const errors = [], keys = [], writes = [], payments = new Map();
  page.on('pageerror', error => errors.push(error.message));
  const customer = { id: 'customer-1', name: 'Cliente do pagamento parcial' };
  const charge = { id: 'charge-1', customerId: customer.id, customer, currency: 'BRL', amountCents: 15000, paidAmountCents: 0, balanceCents: 15000, status: 'PENDING', dueDate: '2026-11-20T12:00:00Z', updatedAt: '2026-11-17T12:00:00Z' };
  let cancelCount = 0, releasePayment, releaseCancel, readsHeld = false, releaseReads;
  const readGate = new Promise(resolve => releaseReads = resolve);
  const error = (path, message) => ({ error: { json: { message, code: -32603, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 503, path } } } });
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
    const go = history.go.bind(history);
    window.__guardMoves = 0;
    history.go = delta => { window.__guardMoves++; go(delta); };
  });
  await page.route('**/api/consent', route => route.fulfill({ contentType: 'application/json', body: '{"success":true}' }));
  await page.route('**/api/trpc/**', async route => {
    const req = route.request(), url = new URL(req.url());
    const names = url.pathname.split('/api/trpc/')[1].split(',');
    if (req.method() === 'POST') writes.push(...names);
    const inputs = JSON.parse(req.method() === 'POST' ? req.postData() || '{}' : url.searchParams.get('input') || '{}');
    const out = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i], input = inputs[i]?.json ?? inputs[i] ?? {};
      if (name === 'finance.charges.pay') {
        keys.push(input.idempotencyKey);
        const existing = payments.get(input.idempotencyKey);
        if (!existing) {
          assert.equal(input.amountCents, 5000);
          payments.set(input.idempotencyKey, { ok: true, paymentId: `payment-${payments.size + 1}`, idempotent: false });
          charge.paidAmountCents += input.amountCents;
          charge.balanceCents -= input.amountCents;
        }
        if (keys.length === 1) {
          await new Promise(resolve => releasePayment = resolve);
          out.push(error(name, 'Resposta perdida após pagamento')); continue;
        }
        out.push({ result: { data: { json: { ...payments.get(input.idempotencyKey), idempotent: Boolean(existing) } } } }); continue;
      }
      if (name === 'finance.charges.cancel') {
        cancelCount++;
        assert.equal(input.cancellationReason, 'Cliente solicitou cancelamento');
        assert.equal(input.expectedUpdatedAt, charge.updatedAt);
        if (cancelCount === 1) {
          await new Promise(resolve => releaseCancel = resolve);
          out.push(error(name, 'Cancelamento temporariamente indisponível')); continue;
        }
        charge.status = 'CANCELED'; readsHeld = true;
        out.push({ result: { data: { json: { id: charge.id, status: 'CANCELED', canceledAt: '2026-11-18T12:00:00Z', canceledByUserId: 'user-1', cancellationReason: input.cancellationReason, idempotent: false } } } }); continue;
      }
      if (readsHeld && name.startsWith('finance.')) { await readGate; out.push(error(name, 'Leitura indisponível após confirmação')); continue; }
      const fixtures = {
        'session.me': { user: { id: 'user-1', organizationId: 'org-1', name: 'Admin', email: 'admin@example.test', role: 'ADMIN' }, requiresOnboarding: false },
        'settings.displayPreferences': { timezone: 'America/Sao_Paulo', currency: 'BRL' },
        'finance.charges.list': { items: [charge], pagination: { total: 1 } },
        'finance.charges.stats': { currencies: ['BRL'], pending: { amountCents: charge.balanceCents, count: 1 }, paid: { amountCents: charge.paidAmountCents, count: 0 }, overdue: { amountCents: 0, count: 0 } },
        'dashboard.notificationCenter.list': { items: [], unreadCount: 0 },
      };
      out.push({ result: { data: { json: fixtures[name] ?? [] } } });
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(out) });
  });
  const nav = page.getByRole('navigation', { name: 'Navegação principal no celular' });
  const prompt = page.getByRole('alertdialog', { name: 'Descartar alterações?', exact: true });
  const payment = page.getByRole('dialog', { name: 'Registrar pagamento manual', exact: true });
  const cancellation = page.getByRole('dialog', { name: 'Cancelar cobrança', exact: true });
  const unloadBlocked = () => page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event); return event.defaultPrevented;
  });
  const continueEditing = async () => {
    await prompt.waitFor();
    await prompt.getByRole('button', { name: 'Continuar editando', exact: true }).click();
    await prompt.waitFor({ state: 'hidden' });
  };
  const back = async () => page.evaluate(() => history.back());
  const finance = async () => {
    await nav.getByRole('button', { name: 'Financeiro', exact: true }).click();
    await page.waitForURL('**/finances');
  };
  const openPayment = async () => {
    await page.getByRole('button', { name: 'Registrar pagamento', exact: true }).first().click();
    await payment.waitFor();
  };
  await page.goto('http://localhost:5173/profile');
  const consent = page.getByRole('button', { name: 'Somente essenciais', exact: true });
  if (await consent.isVisible()) await consent.click();
  await finance(); await openPayment();
  assert.equal(await unloadBlocked(), false, 'Pre-filled official balance is clean');
  await payment.getByRole('button', { name: 'Voltar', exact: true }).click();
  await payment.waitFor({ state: 'hidden' }); assert.equal(await prompt.count(), 0);
  await openPayment();
  const amount = payment.getByLabel('Valor exato em centavos', { exact: true });
  await amount.fill('5000');
  assert.equal(await unloadBlocked(), true);
  await payment.getByRole('button', { name: 'Voltar', exact: true }).click();
  await continueEditing(); assert.equal(await amount.inputValue(), '5000');
  await page.keyboard.press('Escape'); await prompt.waitFor();
  await page.keyboard.press('Escape'); await prompt.waitFor({ state: 'hidden' });
  assert.equal(await amount.inputValue(), '5000');
  await back(); await prompt.waitFor();
  assert(new URL(page.url()).pathname === '/finances');
  await continueEditing(); assert.equal(await amount.inputValue(), '5000');
  await back(); await prompt.waitFor();
  await prompt.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await page.waitForURL('**/profile');
  assert.equal(keys.length, 0, 'Discard cannot send a payment');
  await finance(); await openPayment();
  // A method-only edit also belongs to the draft.
  await payment.getByRole('combobox', { name: 'Método do pagamento', exact: true }).click();
  await page.getByRole('option', { name: 'Dinheiro', exact: true }).click();
  await page.getByRole('listbox').waitFor({ state: 'hidden' });
  await payment.getByRole('button', { name: 'Voltar', exact: true }).click();
  await continueEditing();
  assert.match(await payment.getByRole('combobox', { name: 'Método do pagamento', exact: true }).innerText(), /Dinheiro/);
  await payment.getByRole('button', { name: 'Voltar', exact: true }).click();
  await prompt.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await payment.waitFor({ state: 'hidden' });
  // An unchanged, pre-filled submission must still block unload while pending.
  charge.amountCents = 5000; charge.balanceCents = 5000;
  await page.getByRole('button', { name: 'Atualizar Financeiro', exact: true }).first().click();
  await page.getByText('R$ 50,00', { exact: true }).first().waitFor();
  await openPayment(); assert.equal(await amount.inputValue(), '5000');
  assert.equal(await unloadBlocked(), false);
  await payment.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();
  for (let i = 0; !releasePayment && i < 1500; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert(releasePayment); assert.equal(await unloadBlocked(), true);
  const moves = await page.evaluate(() => window.__guardMoves);
  await back();
  await page.waitForFunction(previous => window.__guardMoves > previous, moves);
  await page.waitForFunction(() => location.pathname === '/finances');
  await page.keyboard.press('Escape');
  assert.equal(await payment.isVisible(), true); assert.equal(await prompt.count(), 0);
  releasePayment();
  await payment.getByText(/Não foi possível confirmar o resultado do pagamento/).waitFor();
  await payment.getByRole('button', { name: 'Voltar', exact: true }).click();
  await payment.waitFor({ state: 'hidden' });
  // Cancellation reason survives dismissed prompts and browser Back.
  await page.getByRole('button', { name: 'Cancelar', exact: true }).first().click();
  await cancellation.waitFor();
  const reason = cancellation.getByLabel('Motivo do cancelamento', { exact: true });
  assert.equal(await unloadBlocked(), false);
  await reason.fill('Cliente solicitou cancelamento');
  await cancellation.getByRole('button', { name: 'Voltar', exact: true }).click();
  await continueEditing(); assert.equal(await reason.inputValue(), 'Cliente solicitou cancelamento');
  await back(); await prompt.waitFor(); await continueEditing();
  assert.equal(await reason.inputValue(), 'Cliente solicitou cancelamento');
  await cancellation.getByRole('button', { name: 'Cancelar cobrança', exact: true }).click();
  for (let i = 0; !releaseCancel && i < 1500; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert(releaseCancel); assert.equal(await unloadBlocked(), true);
  await page.keyboard.press('Escape'); assert.equal(await cancellation.isVisible(), true);
  releaseCancel();
  await cancellation.getByText('Cancelamento temporariamente indisponível', { exact: true }).waitFor();
  await cancellation.getByRole('button', { name: 'Voltar', exact: true }).click();
  await prompt.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await cancellation.waitFor({ state: 'hidden' });
  assert.equal(await unloadBlocked(), false);
  assert.equal(cancelCount, 1); assert.equal(keys.length, 1);
  await page.getByRole('button', { name: 'Nova cobrança', exact: true }).first().click();
  const creation = page.getByRole('dialog', { name: 'Nova cobrança', exact: true });
  await creation.waitFor();
  await creation.getByLabel('Valor em reais', { exact: true }).fill('89,90');
  await back(); await prompt.waitFor(); await continueEditing();
  assert.equal(await creation.getByLabel('Valor em reais', { exact: true }).inputValue(), '89,90');
  await back(); await prompt.waitFor();
  await page.screenshot({ path: `/workspace/attachments/finance-form-drafts-${width}.png` });
  await prompt.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await page.waitForURL('**/profile');
  assert.equal(await unloadBlocked(), false);

  assert.deepEqual(writes, ['finance.charges.pay', 'finance.charges.cancel'], 'Discard and navigation cannot create financial writes');
  assert.deepEqual(errors, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log(`PASS ${width}: finance drafts, method-only change, Escape, Back, discard without writes, pending clean payment unload protection`);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
