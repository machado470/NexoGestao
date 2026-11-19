// Vite + isolated apps/api/test/commerce-local-api.ts. Auth/read context is simulated;
// evidence writes and reads go to the real local Nest/PostgreSQL implementation.
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
  let role = "STAFF",
    loseReply = true,
    writeCount = 0;
  const errors = [],
    attempts = [];
  page.on("pageerror", (e) => errors.push(e.message));
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
    );
    const out = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i],
        input = inputs[i]?.json ?? inputs[i] ?? {};
      if (
        [
          "serviceOrders.evidence",
          "serviceOrders.evidenceImage",
          "serviceOrders.addEvidence",
        ].includes(name)
      ) {
        const path =
          `/service-orders/${input.serviceOrderId}/evidence` +
          (name === "serviceOrders.evidenceImage" ? "/" + input.id : "");
        const { serviceOrderId, ...data } = input;
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
        if (name === "serviceOrders.addEvidence") {
          writeCount++;
          attempts.push(input);
          if (response.ok() && loseReply) {
            loseReply = false;
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
    name: "Fotos da execução",
    exact: true,
  });
  await section
    .getByRole("button", { name: "Adicionar foto", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Registrar foto da execução",
    exact: true,
  });
  await modal.waitFor();
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 800;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#e87924";
    ctx.fillRect(0, 0, 1200, 800);
    ctx.fillStyle = "#142037";
    ctx.font = "48px sans-serif";
    ctx.fillText("Registro local de execução", 60, 130);
    return c.toDataURL("image/png").split(",")[1];
  });
  await modal
    .getByLabel("Foto", { exact: true })
    .setInputFiles({
      name: "execucao.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await modal
    .getByRole("img", { name: "Prévia da foto selecionada" })
    .waitFor();
  const description = `Execução conferida na auditoria ${width} ${Date.now()}`;
  await modal
    .getByLabel("O que foi executado?", { exact: true })
    .fill(description);
  await modal
    .getByLabel(
      "Confirmo que esta foto e o relato correspondem à execução desta O.S.",
    )
    .check();
  const save = modal.getByRole("button", {
    name: "Salvar registro",
    exact: true,
  });
  await save.evaluate((node) => {
    node.click();
    node.click();
  });
  await modal
    .getByText("Resposta perdida após salvar", { exact: true })
    .waitFor();
  assert.equal(writeCount, 1);
  assert.equal(
    await modal
      .getByLabel("O que foi executado?", { exact: true })
      .inputValue(),
    description,
  );
  await save.click();
  await modal.waitFor({ state: "hidden" });
  assert.equal(writeCount, 2);
  assert.equal(attempts[0].entryKey, attempts[1].entryKey);
  const row = section.getByRole("listitem").filter({ hasText: description });
  await row.waitFor();
  assert.equal(await row.count(), 1);
  await row.getByRole("button", { name: "Ver foto", exact: true }).click();
  const view = page.getByRole("dialog", {
    name: "Foto registrada",
    exact: true,
  });
  const image = view.getByRole("img", { name: "Foto registrada" });
  await image.waitFor();
  assert(await image.evaluate((img) => img.complete && img.naturalWidth > 0));
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  fs.mkdirSync("/workspace/attachments", { recursive: true });
  await page.screenshot({
    path: `/workspace/attachments/order-photo-${width}.png`,
  });
  await view
    .getByRole("button", { name: "Fechar", exact: true })
    .last()
    .click();
  await section
    .getByRole("button", { name: "Adicionar foto", exact: true })
    .click();
  await modal
    .getByLabel("O que foi executado?", { exact: true })
    .fill("Rascunho que será descartado");
  await modal.getByRole("button", { name: "Cancelar", exact: true }).click();
  const confirm = page.getByRole("alertdialog");
  await confirm.waitFor();
  await confirm.getByRole("button", { name: /descartar/i }).click();
  await modal.waitFor({ state: "hidden" });
  role = "VIEWER";
  await page.reload();
  await section.getByText(description, { exact: true }).waitFor();
  assert.equal(
    await section
      .getByRole("button", { name: "Adicionar foto", exact: true })
      .count(),
    0,
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  await browser.close();
  console.log(
    `PASS ${width}: real private JPEG upload/read, retry without duplication, discard guard, read-only role, viewport`,
  );
})().catch(async (e) => {
  console.error(e);
  if (auditPage) {
    console.error(await auditPage.locator("body").innerText());
    await auditPage.screenshot({
      path: "/workspace/attachments/order-evidence-failure.png",
    });
  }
  process.exit(1);
});
