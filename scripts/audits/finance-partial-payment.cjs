// Local intercepted financial fixtures; never writes to the real API.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const width = Number(process.env.MOBILE_WIDTH || 390);
  const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  page.setDefaultTimeout(15000);
  const errors = [], keys = [], payments = new Map();
  page.on('pageerror', error => errors.push(error.message));
  const customer = { id: 'customer-1', name: 'Cliente do pagamento parcial' };
  const charge = { id: 'charge-1', customerId: customer.id, customer, currency: 'BRL', amountCents: 15000, paidAmountCents: 0, balanceCents: 15000, status: 'PENDING', dueDate: '2026-11-20T12:00:00Z', updatedAt: '2026-11-17T12:00:00Z' };
  let cancelCount = 0, releasePayment, releaseCancel, readsHeld = false, releaseReads;
  const readGate = new Promise(resolve => releaseReads = resolve);
  const error = (path, message) => ({ error: { json: { message, code: -32603, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 503, path } } } });
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.route('**/api/consent', route => route.fulfill({ contentType: 'application/json', body: '{"success":true}' }));
  await page.route('**/api/trpc/**', async route => {
    const req = route.request(), url = new URL(req.url());
    const names = url.pathname.split('/api/trpc/')[1].split(',');
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
  await page.goto('http://localhost:5173/finances');
  const consent = page.getByRole('button', { name: 'Somente essenciais', exact: true });
  if (await consent.isVisible()) await consent.click();
  const payment = page.getByRole('dialog', { name: 'Registrar pagamento manual', exact: true });
  const dismissToasts = async () => {
    for (let i = 0; i < 10; i++) {
      const close = page.getByRole('button', { name: 'Fechar aviso', exact: true }).last();
      if (!await close.count()) return;
      const box = await close.boundingBox();
      assert(box && box.width >= 44 && box.height >= 44, 'Toast close needs a touch target');
      const handle = await close.elementHandle();
      await close.click();
      await page.waitForFunction(node => !node?.isConnected, handle);
    }
    assert.fail('Toasts must be dismissible');
  };
  const openPayment = async () => {
    await dismissToasts();
    const action = page.getByRole('button', { name: 'Registrar pagamento', exact: true }).first();
    await action.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await action.click();
    await payment.waitFor();
  };
  await openPayment();
  const amount = payment.getByLabel('Valor exato em centavos', { exact: true });
  const pay = payment.getByRole('button', { name: 'Confirmar pagamento', exact: true });
  await amount.fill('5000');
  await pay.evaluate(node => { node.click(); node.click(); });
  await page.waitForFunction(() => document.querySelector('#payment-amount')?.disabled);
  for (let i = 0; !releasePayment && i < 1500; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert(releasePayment, 'Payment request must start');
  assert.equal(keys.length, 1); releasePayment();
  await payment.getByText(/Não foi possível confirmar o resultado do pagamento/).waitFor();
  assert.equal(await amount.inputValue(), '5000');
  await pay.click(); await payment.waitFor({ state: 'hidden' });
  assert.equal(keys[0], keys[1]); assert.equal(payments.size, 1);
  // Wait for authoritative refreshed balance before starting a new payment.
  await page.getByText('R$ 100,00', { exact: true }).first().waitFor();
  await openPayment(); assert.equal(await amount.inputValue(), '10000');
  await amount.fill('5000'); await pay.click(); await payment.waitFor({ state: 'hidden' });
  await page.getByText('R$ 50,00', { exact: true }).first().waitFor();
  assert.notEqual(keys[2], keys[1]); assert.equal(payments.size, 2);
  assert.equal(charge.paidAmountCents, 10000); assert.equal(charge.balanceCents, 5000);
  await dismissToasts();
  await page.screenshot({ path: `/workspace/attachments/finance-partial-balance-${width}.png`, fullPage: true });
  const cancelAction = page.getByRole('button', { name: 'Cancelar', exact: true }).first();
  await cancelAction.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await cancelAction.click();
  const cancellation = page.getByRole('dialog', { name: 'Cancelar cobrança', exact: true });
  const reason = cancellation.getByLabel('Motivo do cancelamento', { exact: true });
  const cancel = cancellation.getByRole('button', { name: 'Cancelar cobrança', exact: true });
  await reason.fill('Cliente solicitou cancelamento');
  await cancel.evaluate(node => { node.click(); node.click(); });
  for (let i = 0; !releaseCancel && i < 1500; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert(releaseCancel, 'Cancellation request must start');
  assert.equal(cancelCount, 1); assert.equal(await reason.isDisabled(), true);
  releaseCancel();
  await cancellation.getByText('Cancelamento temporariamente indisponível', { exact: true }).waitFor();
  assert.equal(await reason.inputValue(), 'Cliente solicitou cancelamento');
  await cancel.click(); await cancellation.waitFor({ state: 'hidden' });
  assert.equal(cancelCount, 2); assert.equal(readsHeld, true);
  // Confirmation closes the form while the subsequent reads are still held.
  releaseReads();
  await page.getByText('Carteira indisponível', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `/workspace/attachments/finance-partial-${width}.png`, fullPage: true });
  console.log(`PASS ${width}: lost reply retry, two identical partial payments, official balance, cancel double click/failure/confirmation before reads`);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
