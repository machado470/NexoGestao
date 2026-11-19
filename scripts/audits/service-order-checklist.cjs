// Vite + commerce-local-api.ts on isolated PostgreSQL. Auth/context reads mocked;
// checklist requests use the real local API and database.
const { chromium } = require("playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
let auditPage;
(async () => {
  const fixture = JSON.parse(
    fs.readFileSync("/dev/shm/nexo-commerce-fixture.json", "utf8"),
  );
  const width = Number(process.env.MOBILE_WIDTH || 390);
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
  page.setDefaultTimeout(15000);
  let role = "STAFF";
  const errors = [],
    writes = [],
    loseReplies = new Set([
      "serviceOrders.createChecklistItem",
      "serviceOrders.changeChecklistItem",
    ]);
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("PAGEERROR", e.message);
  });
  await page.addInitScript(
    (theme) => localStorage.setItem("theme", theme),
    process.env.AUDIT_THEME || "dark",
  );
  const order = {
    ...fixture.order,
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
        type: "complete",
        label: "Concluir serviço",
        reason: "Em execução",
      },
    },
    financialSummary: { hasCharge: false },
  };
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
          "serviceOrders.checklist",
          "serviceOrders.createChecklistItem",
          "serviceOrders.changeChecklistItem",
        ].includes(name)
      ) {
        const path =
          `/service-orders/${input.serviceOrderId}/checklist` +
          (name === "serviceOrders.changeChecklistItem"
            ? `/${input.id}/state`
            : "");
        const { serviceOrderId, id, ...data } = input;
        const response = await page.request.fetch(
          "http://127.0.0.1:55440" + path,
          {
            method: req.method(),
            headers: { "x-audit-org": fixture.orgId, "x-audit-role": role },
            ...(req.method() === "POST" ? { data } : {}),
          },
        );
        const body = await response.json();
        let lost = false;
        if (req.method() === "POST") {
          writes.push({ name, input });
          if (response.ok() && loseReplies.has(name)) {
            loseReplies.delete(name);
            lost = true;
          }
        }
        if (!response.ok() || lost)
          out.push({
            error: {
              json: {
                message: lost
                  ? "Resposta perdida após salvar"
                  : String(body.message),
                code: -32603,
                data: {
                  code: "INTERNAL_SERVER_ERROR",
                  httpStatus: lost ? 503 : response.status(),
                  path: name,
                },
              },
            },
          });
        else out.push({ result: { data: { json: body } } });
        continue;
      }
      assert(req.method() !== "POST", `Unexpected write ${name}`);
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
          "auth.me": { id: fixture.actor, role, name: "Profissional" },
          "settings.displayPreferences": {
            timezone: "America/Sao_Paulo",
            currency: "BRL",
          },
          "dashboard.notificationCenter.list": { items: [], unreadCount: 0 },
          "customers.list": [fixture.customer],
          "serviceOrders.getById": order,
          "serviceOrders.list": [order],
          "serviceOrders.page": {
            items: [order],
            meta: { page: 1, pages: 1, total: 1, limit: 8 },
          },
        }[name] ?? [];
      out.push({ result: { data: { json: data } } });
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(out),
    });
  });
  await page.goto("http://localhost:5173/service-orders?id=" + order.id);
  const consent = page.getByRole("button", {
    name: "Somente essenciais",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  const section = page.getByRole("region", {
    name: "Checklist da execução",
    exact: true,
  });
  await section
    .getByRole("button", { name: "Adicionar tarefa", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Adicionar tarefa ao checklist",
    exact: true,
  });
  const title = `Testar equipamento ${width} ${Date.now()}`;
  await modal.getByLabel("Descrição da tarefa", { exact: true }).fill(title);
  const save = modal.getByRole("button", {
    name: "Salvar tarefa",
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
    await modal.getByLabel("Descrição da tarefa", { exact: true }).inputValue(),
    title,
  );
  await save.click();
  await modal.waitFor({ state: "hidden" });
  assert.equal(writes[0].input.entryKey, writes[1].input.entryKey);
  const row = section.getByRole("listitem").filter({ hasText: title }),
    checkbox = row.getByRole("checkbox");
  await row.waitFor();
  assert.equal(await row.count(), 1);
  await checkbox.click();
  await section
    .getByText("Resposta perdida após salvar", { exact: true })
    .waitFor();
  assert.equal(await checkbox.isChecked(), false);
  await checkbox.click();
  await row.getByText(/Concluída por/).waitFor();
  assert.equal(await checkbox.isChecked(), true);
  const marks = writes.filter(
    (w) => w.name === "serviceOrders.changeChecklistItem",
  );
  assert.equal(marks.length, 2);
  assert.equal(marks[0].input.expectedVersion, marks[1].input.expectedVersion);
  await checkbox.click();
  const undo = page.getByRole("dialog", {
    name: "Desmarcar tarefa",
    exact: true,
  });
  await undo.waitFor();
  await undo
    .getByLabel("Motivo para desmarcar", { exact: true })
    .fill("Teste precisa ser repetido após ajuste");
  await undo
    .getByRole("button", { name: "Confirmar motivo", exact: true })
    .click();
  await undo.waitFor({ state: "hidden" });
  await page.waitForFunction(
    (title) =>
      Array.from(document.querySelectorAll("li")).some(
        (li) =>
          li.textContent.includes(title) &&
          li.querySelector("input[type=checkbox]")?.checked === false,
      ),
    title,
  );
  await section
    .getByRole("button", { name: "Adicionar tarefa", exact: true })
    .click();
  await modal
    .getByLabel("Descrição da tarefa", { exact: true })
    .fill("Rascunho");
  await modal.getByRole("button", { name: "Cancelar", exact: true }).click();
  const confirm = page.getByRole("alertdialog");
  await confirm.waitFor();
  await confirm
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  await modal.waitFor({ state: "hidden" });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await section.scrollIntoViewIfNeeded();
  fs.mkdirSync("/workspace/attachments", { recursive: true });
  await page.screenshot({
    path: `/workspace/attachments/order-checklist-${width}.png`,
  });
  role = "VIEWER";
  await page.reload();
  await row.waitFor();
  assert.equal(await checkbox.isDisabled(), true);
  assert.equal(
    await section
      .getByRole("button", { name: "Adicionar tarefa", exact: true })
      .count(),
    0,
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  await browser.close();
  console.log(
    `PASS ${width}: checklist persistence, lost create/mark replies, versioned retry, reasoned undo, discard, read-only role, viewport`,
  );
})().catch(async (e) => {
  console.error(e);
  if (auditPage) {
    console.error(await auditPage.locator("body").innerText());
    await auditPage.screenshot({
      path: "/workspace/attachments/order-checklist-failure.png",
    });
    await auditPage.screenshot({
      path: "/workspace/attachments/checklist-failure.png",
    });
  }
  process.exit(1);
});
