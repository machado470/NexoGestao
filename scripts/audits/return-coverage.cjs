// Auth/read context and plan admission are simulated; return operations persist
// through the real isolated Nest/PostgreSQL implementation.
const { chromium } = require("playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
let auditPage;
(async () => {
  const fixture = JSON.parse(
    fs.readFileSync("/dev/shm/nexo-commerce-fixture.json", "utf8"),
  );
  const width = Number(process.env.MOBILE_WIDTH || 390),
    writes = [],
    errors = [];
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    isMobile: width < 768,
    hasTouch: width < 768,
  });
  auditPage = page;
  page.setDefaultTimeout(30000);
  let role = "MANAGER",
    loseReply = true,
    loseCoverageReply = true;
  const coverageWrites = [];
  const orders = new Map([[fixture.order.id, fixture.order]]);
  const enrich = (o) => ({
    ...o,
    customer: fixture.customer,
    operationalDecision: {
      isOverdue: false,
      overdueDays: 0,
      isStalled: false,
      chargeOverdue: false,
      operationalStatus: "NORMAL",
      priority: "P3",
      riskLabel: "Normal",
      nextAction: {
        type: o.status === "DONE" ? "charge" : "start",
        label: o.status === "DONE" ? "Gerar cobrança" : "Iniciar serviço",
        reason: "Próxima ação",
      },
    },
    financialSummary: { hasCharge: false },
  });
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
      ),
      out = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i],
        input = inputs[i]?.json ?? inputs[i] ?? {};
      if (
        [
          "serviceOrders.returns",
          "serviceOrders.createReturn",
          "serviceOrders.setReturnCoverage",
        ].includes(name)
      ) {
        const path =
          `/service-orders/${input.serviceOrderId}/returns` +
          (req.method() === "GET"
            ? `?page=${input.page}`
            : name === "serviceOrders.setReturnCoverage"
              ? `/${input.id}/coverage`
              : "");
        const { serviceOrderId, id, ...body } = input;
        const response = await page.request.fetch(
          "http://127.0.0.1:55440" + path,
          {
            method: req.method(),
            headers: { "x-audit-org": fixture.orgId, "x-audit-role": role },
            ...(req.method() === "POST" ? { data: body } : {}),
          },
        );
        let data = await response.json(),
          failed = !response.ok();
        if (name === "serviceOrders.createReturn") {
          writes.push(input);
          if (!failed) {
            orders.set(data.child.id, {
              ...fixture.order,
              ...data.child,
              amountCents: null,
              dueDate: null,
              assignedToPersonId: null,
              scheduledFor: null,
            });
            if (loseReply) {
              loseReply = false;
              failed = true;
              data = { message: "Resposta perdida após salvar" };
            }
          }
        }
        if (name === "serviceOrders.setReturnCoverage") {
          coverageWrites.push(input);
          if (!failed) {
            orders.set(data.child.id, {
              ...orders.get(data.child.id),
              ...data.child,
            });
            if (loseCoverageReply) {
              loseCoverageReply = false;
              failed = true;
              data = { message: "Resposta perdida após salvar" };
            }
          }
        }
        out.push(
          failed
            ? {
                error: {
                  json: {
                    message: String(data.message),
                    code: -32603,
                    data: {
                      code: "INTERNAL_SERVER_ERROR",
                      httpStatus: 503,
                      path: name,
                    },
                  },
                },
              }
            : { result: { data: { json: data } } },
        );
        continue;
      }
      assert(req.method() !== "POST", "Unexpected write " + name);
      const currentId =
          new URL(page.url()).searchParams.get("id") || fixture.order.id,
        current = enrich(orders.get(input.id || currentId) || fixture.order);
      const data =
        {
          "session.me": {
            user: {
              id: fixture.actor,
              organizationId: fixture.orgId,
              name: "Profissional",
              email: "test@example.test",
              role,
            },
            requiresOnboarding: false,
          },
          "auth.me": { id: fixture.actor, role },
          "settings.displayPreferences": {
            timezone: "America/Sao_Paulo",
            currency: "BRL",
          },
          "dashboard.notificationCenter.list": { items: [], unreadCount: 0 },
          "customers.list": [fixture.customer],
          "serviceOrders.page": {
            items: [current],
            meta: { page: 1, pages: 1, total: 1, limit: 8 },
          },
          "serviceOrders.getById": current,
          "serviceOrders.list": Array.from(orders.values()).map(enrich),
        }[name] ?? [];
      out.push({ result: { data: { json: data } } });
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(out),
    });
  });
  await page.goto(
    "http://localhost:5173/service-orders?id=" + fixture.order.id,
  );
  const consent = page.getByRole("button", {
    name: "Somente essenciais",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  const section = page.getByRole("region", {
    name: "Garantia e retrabalho",
    exact: true,
  });
  await section
    .getByRole("button", { name: "Abrir retorno", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Abrir retorno do serviço",
    exact: true,
  });
  const title = `Retorno avaliado ${width} ${Date.now()}`;
  await modal.getByLabel("Título da nova O.S.", { exact: true }).fill(title);
  await modal
    .getByRole("combobox", {
      name: "Relato de problema vinculado",
      exact: true,
    })
    .click();
  await page
    .getByRole("option")
    .filter({ hasText: fixture.returnIssue.publicTitle })
    .click();
  assert.equal(
    await modal.getByLabel("Motivo do retorno", { exact: true }).inputValue(),
    fixture.returnIssue.responseNote,
  );
  if (width === 320) {
    await modal
      .getByRole("combobox", { name: "Classificação do retorno", exact: true })
      .click();
    await page.getByRole("option", { name: "Retrabalho", exact: true }).click();
  }
  const save = modal.getByRole("button", {
    name: "Criar O.S. de retorno",
    exact: true,
  });
  await save.evaluate((node) => {
    node.click();
    node.click();
  });
  await modal
    .getByText("Resposta perdida após salvar", { exact: true })
    .waitFor();
  assert.equal(writes.length, 1);
  assert.equal(
    await modal.getByLabel("Título da nova O.S.", { exact: true }).inputValue(),
    title,
  );
  await save.click();
  await modal.waitFor({ state: "hidden" });
  assert.equal(writes.length, 2);
  assert.equal(writes[0].entryKey, writes[1].entryKey);
  assert.equal(writes[0].sourceAcceptanceId, fixture.returnIssue.id);
  const row = section.getByRole("listitem").filter({ hasText: title });
  await row.waitFor();
  assert.equal(await row.count(), 1);
  await row
    .getByRole("button", { name: "Ver O.S. de retorno", exact: true })
    .click();
  const childId = new URL(page.url()).searchParams.get("id");
  assert.notEqual(childId, fixture.order.id);
  await section.getByText(/Esta O.S. é um retorno de:/).waitFor();
  assert.equal(
    await section
      .getByRole("button", { name: "Abrir retorno", exact: true })
      .count(),
    0,
  );
  await section
    .getByRole("button", { name: "Ver O.S. original", exact: true })
    .click();
  await page.waitForURL("**/service-orders?id=" + fixture.order.id);
  await row.waitFor();
  await section.scrollIntoViewIfNeeded();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  fs.mkdirSync("/workspace/attachments", { recursive: true });
  await page.screenshot({
    path: `/workspace/attachments/service-returns-${width}.png`,
  });
  await section
    .getByRole("button", { name: "Abrir retorno", exact: true })
    .click();
  await modal
    .getByLabel("Motivo do retorno", { exact: true })
    .fill("Rascunho para descartar");
  await modal.getByRole("button", { name: "Cancelar", exact: true }).click();
  const discard = page.getByRole("alertdialog");
  await discard.waitFor();
  await discard
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  await modal.waitFor({ state: "hidden" });
  const editor = row.locator('[aria-label="Condição comercial do retorno"]');
  await editor
    .getByRole("button", { name: "Registrar decisão comercial", exact: true })
    .click();
  const decision = page.getByRole("dialog", {
    name: "Decidir cobertura do retorno",
    exact: true,
  });
  await decision
    .getByRole("combobox", { name: "Condição comercial", exact: true })
    .click();
  await page
    .getByRole("option", {
      name: "Coberto, sem cobrança nesta O.S.",
      exact: true,
    })
    .click();
  await decision
    .getByLabel("Motivo da decisão", { exact: true })
    .fill("Cobertura aprovada após avaliação técnica.");
  const confirmDecision = decision.getByRole("button", {
    name: "Confirmar decisão",
    exact: true,
  });
  await confirmDecision.evaluate((node) => {
    node.click();
    node.click();
  });
  await decision
    .getByText("Resposta perdida após salvar", { exact: true })
    .waitFor();
  assert.equal(coverageWrites.length, 1);
  await confirmDecision.click();
  await decision.waitFor({ state: "hidden" });
  assert.equal(coverageWrites.length, 2);
  assert.equal(
    coverageWrites[0].expectedVersion,
    coverageWrites[1].expectedVersion,
  );
  await editor
    .getByText("Cobertura aprovada · sem cobrança nesta O.S.", { exact: true })
    .waitFor();
  await editor
    .getByRole("button", { name: "Registrar decisão comercial", exact: true })
    .click();
  await decision
    .getByRole("combobox", { name: "Condição comercial", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Serviço cobrável", exact: true })
    .click();
  await decision
    .getByLabel("Motivo da decisão", { exact: true })
    .fill("Cliente aprovou atendimento fora da cobertura.");
  await confirmDecision.click();
  await decision.waitFor({ state: "hidden" });
  await editor.getByText("Serviço cobrável", { exact: true }).waitFor();
  await editor.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `/workspace/attachments/return-coverage-${width}.png`,
  });
  await editor
    .getByRole("button", { name: "Registrar decisão comercial", exact: true })
    .click();
  await decision
    .getByLabel("Motivo da decisão", { exact: true })
    .fill("Rascunho da revisão comercial.");
  await decision.getByRole("button", { name: "Cancelar", exact: true }).click();
  const decisionDiscard = page.getByRole("alertdialog");
  await decisionDiscard.waitFor();
  await decisionDiscard
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  await decision.waitFor({ state: "hidden" });
  role = "STAFF";
  await page.reload();
  await row.waitFor();
  assert.equal(
    await row
      .getByRole("button", { name: "Registrar decisão comercial", exact: true })
      .count(),
    0,
  );
  role = "VIEWER";
  await page.reload();
  await row.waitFor();
  assert.equal(
    await section
      .getByRole("button", { name: "Abrir retorno", exact: true })
      .count(),
    0,
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  await browser.close();
  console.log(
    `PASS ${width}: coverage approval/replay, versioned revision, discard, manager/staff/viewer roles, linked return, viewport`,
  );
})().catch(async (e) => {
  console.error(e);
  if (auditPage) {
    console.error(await auditPage.locator("body").innerText());
    await auditPage.screenshot({
      path: "/workspace/attachments/coverage-failure.png",
    });
  }
  process.exit(1);
});
