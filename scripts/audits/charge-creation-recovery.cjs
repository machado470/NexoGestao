// Intercepted local fixtures only. No real charges are created.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: Number(process.env.MOBILE_WIDTH || 390), height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  page.setDefaultTimeout(12000);
  const customer = {
    id: "customer-1",
    name: "Cliente da recuperação",
    active: true,
  };
  const saved = new Map(),
    keys = [],
    errors = [];
  let releaseResponse,
    onStarted,
    failReads = false;
  const started = new Promise((resolve) => (onStarted = resolve));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.route("**/api/consent", (r) =>
    r.fulfill({ contentType: "application/json", body: '{"success":true}' }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      names = url.pathname.split("/api/trpc/")[1].split(",");
    const inputs = JSON.parse(
      req.method() === "POST"
        ? req.postData() || "{}"
        : url.searchParams.get("input") || "{}",
    );
    const response = [];
    for (let index = 0; index < names.length; index++) {
      const name = names[index],
        input = inputs[index]?.json ?? inputs[index] ?? {};
      if (name === "finance.charges.create") {
        keys.push(input.idempotencyKey);
        if (!saved.has(input.idempotencyKey))
          saved.set(input.idempotencyKey, {
            ...input,
            id: "charge-" + saved.size,
            customer,
            currency: "BRL",
            status: "PENDING",
            balanceCents: input.amountCents,
            paidAmountCents: 0,
          });
        if (keys.length === 1) {
          await new Promise((resolve) => {
            releaseResponse = resolve;
            onStarted();
          });
          response.push({
            error: {
              json: {
                message: "Resposta interrompida após salvar",
                code: -32603,
                data: {
                  code: "INTERNAL_SERVER_ERROR",
                  httpStatus: 503,
                  path: name,
                },
              },
            },
          });
          continue;
        }
        if (keys.length === 2) failReads = true;
        response.push({
          result: { data: { json: saved.get(input.idempotencyKey) } },
        });
        continue;
      }
      if (
        failReads &&
        ["finance.charges.list", "finance.charges.stats"].includes(name)
      ) {
        response.push({
          error: {
            json: {
              message: "Leitura temporariamente indisponível",
              code: -32603,
              data: {
                code: "INTERNAL_SERVER_ERROR",
                httpStatus: 503,
                path: name,
              },
            },
          },
        });
        continue;
      }
      const fixtures = {
        "session.me": {
          user: {
            id: "user-1",
            organizationId: "org-1",
            name: "Admin",
            role: "ADMIN",
            email: "admin@example.test",
          },
          requiresOnboarding: false,
        },
        "settings.displayPreferences": {
          timezone: "America/Sao_Paulo",
          currency: "BRL",
        },
        "customers.list": [customer],
        "finance.charges.list": {
          items: [...saved.values()],
          pagination: { total: saved.size },
        },
        "finance.charges.stats": {
          currencies: ["BRL"],
          pending: { amountCents: saved.size * 15000, count: saved.size },
          paid: { amountCents: 0, count: 0 },
          overdue: { amountCents: 0, count: 0 },
        },
        "dashboard.notificationCenter.list": { items: [], unreadCount: 0 },
      };
      response.push({ result: { data: { json: fixtures[name] ?? [] } } });
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
  await page.goto(
    "http://localhost:5173/finances?customerId=customer-1&action=create",
  );
  const consent = page.getByRole("button", {
    name: "Somente essenciais",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  const form = page.getByRole("dialog", { name: "Nova cobrança", exact: true });
  await form.waitFor();
  await form
    .getByRole("combobox")
    .first()
    .getByText(customer.name, { exact: true })
    .waitFor();
  assert.equal(
    await form.getByRole("combobox").first().innerText(),
    customer.name,
  );
  await form.getByRole("button", { name: "Cancelar", exact: true }).click();
  await form.waitFor({ state: "hidden" });
  assert.equal(
    await page.getByRole("alertdialog").count(),
    0,
    "Context alone must not count as an edit",
  );
  const open = async () => {
    await page
      .getByRole("button", { name: "Nova cobrança", exact: true })
      .first()
      .click();
    await form.waitFor();
  };
  const fill = async () => {
    await form.getByLabel("Valor em reais", { exact: true }).fill("150,00");
    await form.getByLabel("Vencimento *", { exact: true }).fill("2026-11-20");
  };
  const submit = form
    .getByRole("button", { name: "Apenas criar", exact: true })
    .last();
  await open();
  await fill();
  await submit.evaluate((node) => {
    node.click();
    node.click();
  });
  await started;
  assert.equal(
    keys.length,
    1,
    "Double click must issue only one create request",
  );
  assert.equal(saved.size, 1);
  releaseResponse();
  await page
    .getByText("Resposta interrompida após salvar", { exact: true })
    .waitFor();
  assert.equal(
    await form.getByLabel("Valor em reais", { exact: true }).inputValue(),
    "150,00",
  );
  assert.equal(
    await form.getByLabel("Vencimento *", { exact: true }).inputValue(),
    "2026-11-20",
  );
  await submit.click();
  await form.waitFor({ state: "hidden" });
  await page
    .getByText(
      "A carteira financeira está indisponível. Sua sessão continua válida.",
      { exact: true },
    )
    .waitFor();
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1], "An uncertain creation must reuse its key");
  assert.equal(
    saved.size,
    1,
    "Retry must reuse the simulated persisted charge",
  );
  assert.equal(
    await page.getByText("Ação crítica em andamento", { exact: true }).count(),
    0,
    "A confirmed write must not wait behind read failures",
  );
  failReads = false;
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nova cobrança", exact: true })
    .first()
    .waitFor();
  await open();
  await fill();
  await submit.click();
  await form.waitFor({ state: "hidden" });
  assert.equal(keys.length, 3);
  assert.notEqual(keys[1], keys[2], "A deliberate new charge gets a fresh key");
  assert.equal(saved.size, 2);
  assert.deepEqual(errors, []);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await browser.close();
  console.log(
    "PASS: contextual customer, clean close, double submit, uncertain retry, confirmed write with failed reads, and deliberate new charge.",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
