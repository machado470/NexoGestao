// Browser auth is simulated; commerce requests use the isolated Nest/PostgreSQL API.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const fixture = JSON.parse(
    fs.readFileSync("/dev/shm/nexo-commerce-fixture.json", "utf8"),
  );
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const width = Number(process.env.MOBILE_WIDTH || 390);
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    isMobile: width < 768,
    hasTouch: width < 768,
  });
  page.setDefaultTimeout(20000);
  let role = "ADMIN",
    lostMove = true;
  const calls = [],
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    (theme) => localStorage.setItem("theme", theme),
    process.env.AUDIT_THEME || "dark",
  );
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
    const out = [];
    for (let i = 0; i < names.length; i++) {
      const n = names[i],
        input = inputs[i]?.json ?? inputs[i] ?? {};
      if (n.startsWith("commerce.")) {
        calls.push({ name: n, input });
        const paths = {
          products: `products?page=${input.page || 1}&q=${encodeURIComponent(input.q || "")}`,
          createProduct: "products",
          movements: "movements",
          move: "movements",
          fiscalDrafts: "fiscal-drafts",
          createFiscalDraft: "fiscal-drafts",
          health: `health${input.month ? "?month=" + input.month : ""}`,
          recordExpense: "expenses",
          classifyExpenseCurrency: "expenses/currency",
        };
        const key = n.split(".")[1];
        assert(paths[key], n);
        const response = await page.request.fetch(
          "http://127.0.0.1:55440/commerce/" + paths[key],
          {
            method: req.method(),
            headers: { "x-audit-org": fixture.orgId, "x-audit-role": role },
            ...(req.method() === "POST" ? { data: input } : {}),
          },
        );
        const body = await response.json();
        let failure = !response.ok(),
          message = Array.isArray(body.message)
            ? body.message.join(" · ")
            : body.message,
          status = response.status();
        if (key === "move" && response.ok() && lostMove) {
          lostMove = false;
          failure = true;
          message = "Resposta perdida na simulação após salvar";
          status = 503;
        }
        if (failure) {
          out.push({
            error: {
              json: {
                message: message || "Não foi possível consultar",
                code: -32603,
                data: {
                  code:
                    status === 403
                      ? "FORBIDDEN"
                      : status === 409
                        ? "CONFLICT"
                        : status === 400
                          ? "BAD_REQUEST"
                          : "INTERNAL_SERVER_ERROR",
                  httpStatus: status,
                  path: n,
                },
              },
            },
          });
          continue;
        }
        out.push({ result: { data: { json: body } } });
        continue;
      }
      const data =
        {
          "session.me": {
            user: {
              id: fixture.actor,
              organizationId: fixture.orgId,
              name: "Admin da validação",
              email: "audit@example.test",
              role,
            },
            requiresOnboarding: false,
          },
          "auth.me": {
            id: fixture.actor,
            name: "Admin da validação",
            email: "audit@example.test",
            role,
            organization: { id: fixture.orgId, name: "Empresa da validação" },
          },
          "settings.displayPreferences": {
            timezone: "America/Sao_Paulo",
            currency: "BRL",
          },
          "customers.list": [fixture.customer],
          "dashboard.notificationCenter.list": { items: [], unreadCount: 0 },
        }[n] ?? [];
      assert(req.method() !== "POST", `Unexpected write ${n}`);
      out.push({ result: { data: { json: data } } });
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(out),
    });
  });
  await page.goto("http://localhost:5173/profile");
  await page
    .getByText("Horários em America/Sao_Paulo", { exact: true })
    .waitFor();
  const consent = page.getByRole("button", {
    name: "Somente essenciais",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  if (width < 768) {
    await page.getByRole("button", { name: "Mais", exact: true }).click();
    const nav = page.getByRole("navigation", { name: "Todas as áreas" });
    for (const name of ["Estoque", "Notas fiscais", "Saúde financeira"])
      assert.equal(
        await nav.getByRole("button", { name, exact: true }).count(),
        1,
      );
    await nav.getByRole("button", { name: "Estoque", exact: true }).click();
  } else
    await page
      .getByRole("button", { name: "Estoque", exact: true })
      .first()
      .click();
  await page.waitForURL("**/inventory");
  await page.getByRole("button", { name: "Novo produto", exact: true }).click();
  const product = page.getByRole("dialog", {
    name: "Novo produto",
    exact: true,
  });
  await product.waitFor();
  const sku = "AUDIT-" + width + "-" + Date.now();
  const expenseTitle = "Deslocamento da validação " + width + " " + Date.now();
  await product.getByLabel("SKU", { exact: true }).fill(sku);
  await product
    .getByLabel("Nome do produto", { exact: true })
    .fill("Filtro para manutenção " + width);
  await product
    .getByLabel("Variação, como modelo, cor ou voltagem", { exact: true })
    .fill("220 V");
  await product
    .getByLabel("Estoque mínimo (unidades inteiras)", { exact: true })
    .fill("2");
  await product
    .getByLabel("Custo unitário (BRL)", { exact: true })
    .fill("10,00");
  await product
    .getByLabel("Preço de venda (BRL)", { exact: true })
    .fill("25,00");
  await product
    .getByRole("button", { name: "Cadastrar produto", exact: true })
    .evaluate((node) => {
      node.click();
      node.click();
    });
  await product.waitFor({ state: "hidden" });
  assert.equal(
    calls.filter((c) => c.name === "commerce.createProduct").length,
    1,
  );
  await page
    .getByLabel("Buscar por nome, SKU ou código de barras", { exact: true })
    .fill(sku);
  const card = page.getByRole("article").filter({ hasText: sku });
  await card.waitFor();
  await card.getByRole("button", { name: "Entrada", exact: true }).click();
  const move = page.getByRole("dialog", {
    name: "Movimentar estoque",
    exact: true,
  });
  await move.waitFor();
  await move
    .getByLabel("Quantidade (unidades inteiras)", { exact: true })
    .fill("5");
  await move.getByLabel("Motivo", { exact: true }).fill("Compra da validação");
  await move
    .getByLabel("Identificador da O.S. (opcional)", { exact: true })
    .fill(fixture.order.id);
  await move
    .getByRole("button", { name: "Confirmar movimentação", exact: true })
    .evaluate((node) => {
      node.click();
      node.click();
    });
  await move
    .getByText("Resposta perdida na simulação após salvar", { exact: true })
    .waitFor();
  assert.equal(
    await move
      .getByLabel("Quantidade (unidades inteiras)", { exact: true })
      .inputValue(),
    "5",
  );
  await move
    .getByRole("button", { name: "Confirmar movimentação", exact: true })
    .click();
  await move.waitFor({ state: "hidden" });
  const moves = calls.filter((c) => c.name === "commerce.move");
  assert.equal(moves.length, 2);
  assert.equal(moves[0].input.entryKey, moves[1].input.entryKey);
  await page.waitForFunction(
    (sku) =>
      [...document.querySelectorAll("article")]
        .find((n) => n.textContent.includes(sku))
        ?.textContent.includes("5 unidades"),
    sku,
  );
  await card.getByRole("button", { name: "Saída", exact: true }).click();
  await move
    .getByLabel("Quantidade (unidades inteiras)", { exact: true })
    .fill("6");
  await move.getByLabel("Motivo", { exact: true }).fill("Saída acima do saldo");
  await move
    .getByRole("button", { name: "Confirmar movimentação", exact: true })
    .click();
  await move
    .getByText("Saldo insuficiente ou limite de estoque excedido", {
      exact: true,
    })
    .waitFor();
  await move.getByRole("button", { name: "Cancelar", exact: true }).click();
  const discard = page.getByRole("alertdialog", {
    name: "Descartar alterações?",
    exact: true,
  });
  await discard
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  await move.waitFor({ state: "hidden" });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: `/workspace/attachments/commerce-stock-${width}.png`,
    fullPage: true,
  });
  const tabs = page.getByRole("navigation", {
    name: "Estoque, fiscal e saúde financeira",
  });
  await tabs.getByRole("link", { name: "Notas fiscais", exact: true }).click();
  await page
    .getByRole("button", { name: "Preparar nota", exact: true })
    .click();
  const fiscal = page.getByRole("dialog", {
    name: "Preparar nota fiscal",
    exact: true,
  });
  await fiscal.waitFor();
  await fiscal
    .getByRole("combobox", { name: "Cliente da nota", exact: true })
    .click();
  await page
    .getByRole("option", { name: fixture.customer.name, exact: true })
    .click();
  await page.getByRole("listbox").waitFor({ state: "hidden" });
  await fiscal
    .getByLabel("Identificador da O.S. (opcional)", { exact: true })
    .fill(fixture.order.id);
  await fiscal
    .getByLabel("Descrição do serviço", { exact: true })
    .fill("Manutenção preventiva com troca de filtro");
  await fiscal
    .getByLabel("Valor do serviço (BRL)", { exact: true })
    .fill("150,00");
  await fiscal
    .getByRole("button", { name: "Salvar preparação", exact: true })
    .click();
  await fiscal.waitFor({ state: "hidden" });
  await page
    .getByText("Preparação salva. Nenhuma nota foi emitida.", { exact: true })
    .waitFor();
  assert.equal(await page.getByRole("button", { name: /Emitir/ }).count(), 0);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: `/workspace/attachments/commerce-fiscal-${width}.png`,
    fullPage: true,
  });
  await tabs
    .getByRole("link", { name: "Saúde financeira", exact: true })
    .click();
  await page.getByLabel("Mês de análise", { exact: true }).fill("2026-11");
  await page
    .getByRole("button", { name: "Registrar despesa", exact: true })
    .click();
  const expense = page.getByRole("dialog", {
    name: "Registrar despesa",
    exact: true,
  });
  await expense.waitFor();
  await expense
    .getByLabel("Descrição da despesa", { exact: true })
    .fill(expenseTitle);
  await expense.getByLabel("Valor (BRL)", { exact: true }).fill("10,00");
  await expense
    .getByLabel("Data da despesa", { exact: true })
    .fill("2026-11-19");
  await expense
    .getByRole("button", { name: "Salvar despesa", exact: true })
    .click();
  await expense.waitFor({ state: "hidden" });
  const classify = page.getByRole("button", {
    name: "Definir moeda original",
    exact: true,
  });
  if (await classify.count()) {
    await classify.first().click();
    const currency = page.getByRole("dialog", {
      name: "Definir moeda da despesa",
      exact: true,
    });
    await currency
      .getByLabel("Moeda original (código de 3 letras)", { exact: true })
      .fill("BRL");
    await currency
      .getByRole("button", { name: "Confirmar moeda", exact: true })
      .click();
    await currency.waitFor({ state: "hidden" });
  }
  await page.getByText(expenseTitle, { exact: true }).waitFor();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: `/workspace/attachments/commerce-health-${width}.png`,
    fullPage: true,
  });
  role = "STAFF";
  let before = calls.filter((c) =>
    ["commerce.products", "commerce.movements"].includes(c.name),
  ).length;
  await page.goto("http://localhost:5173/inventory");
  await page.getByText("Acesso restrito", { exact: true }).waitFor();
  assert.equal(
    calls.filter((c) =>
      ["commerce.products", "commerce.movements"].includes(c.name),
    ).length,
    before,
    "Staff cannot query inventory",
  );
  await page.goto("http://localhost:5173/profile");
  await page
    .getByText("Horários em America/Sao_Paulo", { exact: true })
    .waitFor();
  if (width < 768) {
    await page.getByRole("button", { name: "Mais", exact: true }).click();
    const nav = page.getByRole("navigation", { name: "Todas as áreas" });
    for (const name of ["Estoque", "Notas fiscais", "Saúde financeira"])
      assert.equal(
        await nav.getByRole("button", { name, exact: true }).count(),
        0,
      );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS",
    width,
    "three sections, real local persistence, repeated lost-reply movement, negative-stock rejection, fiscal preparation, expenses/currency classification and role gates",
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
