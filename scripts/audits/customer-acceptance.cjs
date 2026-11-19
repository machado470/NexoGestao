// Auth/context reads simulated; acceptance calls use real isolated Nest/PostgreSQL.
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
    urls = [],
    errors = [];
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const settings = {
    viewport: { width, height: 844 },
    isMobile: width < 768,
    hasTouch: width < 768,
  };
  const internal = await browser.newPage(settings),
    client = await browser.newPage(settings);
  auditPage = internal;
  let loseCreate = true,
    loseResponse = true,
    failRevoke = true;
  const title = `Entrega revisada ${width} ${Date.now()}`,
    summary =
      "Manutenção realizada e equipamento testado conforme o combinado.";
  const order = {
    ...fixture.order,
    status: "DONE",
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
        type: "charge",
        label: "Gerar cobrança",
        reason: "Serviço concluído",
      },
    },
    financialSummary: { hasCharge: false },
  };
  async function setup(page, anonymous) {
    page.setDefaultTimeout(25000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => urls.push(r.url()));
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
        if (name.startsWith("serviceAcceptance.")) {
          const method = name.split(".")[1],
            path =
              method === "view" || method === "respond"
                ? "/service-acceptance/" + method
                : `/service-orders/${input.serviceOrderId}/acceptances` +
                  (method === "revoke" ? "/" + input.id + "/revoke" : "");
          const { serviceOrderId, id, ...body } = input;
          let status,
            data,
            failed = false;
          if (method === "revoke" && failRevoke) {
            failRevoke = false;
            status = 503;
            data = { message: "Falha temporária ao revogar" };
            failed = true;
          } else {
            const response = await page.request.fetch(
              "http://127.0.0.1:55440" + path,
              {
                method: req.method(),
                headers: {
                  "x-audit-org": fixture.orgId,
                  "x-audit-role": "STAFF",
                },
                ...(req.method() === "POST" ? { data: body } : {}),
              },
            );
            status = response.status();
            data = await response.json();
            failed = !response.ok();
            if (
              (method === "create" && loseCreate) ||
              (method === "respond" && loseResponse)
            ) {
              if (!failed) {
                if (method === "create") loseCreate = false;
                else loseResponse = false;
                failed = true;
                status = 503;
                data = { message: "Resposta perdida após salvar" };
              }
            }
          }
          if (req.method() === "POST") writes.push({ method, input });
          out.push(
            failed
              ? {
                  error: {
                    json: {
                      message: String(data.message),
                      code: -32603,
                      data: {
                        code: "INTERNAL_SERVER_ERROR",
                        httpStatus: status,
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
        const data =
          {
            "session.me": {
              user: anonymous
                ? null
                : {
                    id: fixture.actor,
                    organizationId: fixture.orgId,
                    name: "Profissional",
                    email: "test@example.test",
                    role: "STAFF",
                  },
              requiresOnboarding: false,
            },
            "auth.me": anonymous ? null : { id: fixture.actor, role: "STAFF" },
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
  }
  await setup(internal, false);
  await setup(client, true);
  await internal.goto("http://localhost:5173/service-orders?id=" + order.id);
  const consent = internal.getByRole("button", {
    name: "Somente essenciais",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  const section = internal.getByRole("region", {
    name: "Aceite do cliente",
    exact: true,
  });
  await section
    .getByRole("button", { name: "Gerar link de aceite", exact: true })
    .click();
  const form = internal.getByRole("dialog", {
    name: "Preparar aceite do cliente",
    exact: true,
  });
  await form
    .getByLabel("Título que o cliente verá", { exact: true })
    .fill(title);
  await form.getByLabel("Resumo compartilhado", { exact: true }).fill(summary);
  await form
    .getByRole("button", { name: "Gerar link", exact: true })
    .evaluate((node) => {
      node.click();
      node.click();
    });
  await form
    .getByText("Resposta perdida após salvar", { exact: true })
    .waitFor();
  assert.equal(writes.filter((w) => w.method === "create").length, 1);
  await form.getByRole("button", { name: "Gerar link", exact: true }).click();
  await form.waitFor({ state: "hidden" });
  const creates = writes.filter((w) => w.method === "create");
  assert.equal(creates[0].input.entryKey, creates[1].input.entryKey);
  const link = await section
      .getByLabel("Link para o cliente", { exact: true })
      .inputValue(),
    token = new URL(link).hash.slice(1);
  assert.equal(new URL(link).search, "");
  assert.equal(token.length, 64);
  auditPage = client;
  await client.goto(link);
  await client.getByRole("heading", { name: title, exact: true }).waitFor();
  const clientConsent = client.getByRole("button", {
    name: "Somente essenciais",
    exact: true,
  });
  if (await clientConsent.isVisible()) await clientConsent.click();
  assert(!client.url().includes("/login"));
  assert(
    !(await client.locator("body").innerText()).includes(
      fixture.customer.phone,
    ),
  );
  await client
    .getByLabel("Seu nome", { exact: true })
    .fill("Cliente da validação");
  if (width === 320) {
    await client.getByLabel("Apontar um problema", { exact: true }).check();
    await client
      .getByLabel("Descreva o problema", { exact: true })
      .fill("O equipamento ainda apresenta ruído após a entrega.");
  }
  await client
    .getByLabel(
      "Li o resumo e confirmo o envio desta resposta. Ela não poderá ser alterada por este link.",
    )
    .check();
  const send = client.getByRole("button", {
    name: "Enviar resposta",
    exact: true,
  });
  await send.evaluate((node) => {
    node.click();
    node.click();
  });
  await client
    .getByText("Resposta perdida após salvar", { exact: true })
    .waitFor();
  assert.equal(writes.filter((w) => w.method === "respond").length, 1);
  await send.click();
  await client
    .getByRole("heading", {
      name: width === 320 ? "Problema registrado" : "Entrega confirmada",
      exact: true,
    })
    .waitFor();
  const replies = writes.filter((w) => w.method === "respond");
  assert.equal(replies[0].input.responseKey, replies[1].input.responseKey);
  assert(
    urls.every((url) => !url.includes(token)),
    "Bearer-link secret appeared in a request URL",
  );
  assert(
    await client.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  fs.mkdirSync("/workspace/attachments", { recursive: true });
  await client.screenshot({
    path: `/workspace/attachments/customer-acceptance-${width}.png`,
  });
  auditPage = internal;
  await internal.reload();
  const row = section.getByRole("listitem").filter({ hasText: title });
  await row.waitFor();
  assert.equal(await row.count(), 1);
  await row
    .getByText("Nome informado: Cliente da validação", { exact: false })
    .waitFor();
  await row
    .getByRole("button", { name: "Revogar acesso ao link", exact: true })
    .click();
  const revokeModal = internal.getByRole("dialog", {
    name: "Revogar link de aceite?",
    exact: true,
  });
  await revokeModal
    .getByRole("button", { name: "Revogar link", exact: true })
    .click();
  await revokeModal
    .getByText("Falha temporária ao revogar", { exact: true })
    .waitFor();
  await revokeModal
    .getByRole("button", { name: "Revogar link", exact: true })
    .click();
  await revokeModal.waitFor({ state: "hidden" });
  await client.reload();
  await client
    .getByText(
      "Link indisponível ou expirado. Solicite um novo link à empresa.",
      { exact: true },
    )
    .waitFor();
  // Open another bearer link in the same tab: a hash-only navigation must reset the old form.
  await section
    .getByRole("button", { name: "Gerar link de aceite", exact: true })
    .click();
  await form
    .getByLabel("Título que o cliente verá", { exact: true })
    .fill(title + " revisão");
  await form
    .getByLabel("Resumo compartilhado", { exact: true })
    .fill(summary + " Revisão compartilhada.");
  await form.getByRole("button", { name: "Gerar link", exact: true }).click();
  await form.waitFor({ state: "hidden" });
  const nextLink = await section
    .getByLabel("Link para o cliente", { exact: true })
    .inputValue();
  await client.goto(nextLink);
  await client
    .getByRole("heading", { name: title + " revisão", exact: true })
    .waitFor();
  assert.equal(
    await client.getByLabel("Seu nome", { exact: true }).inputValue(),
    "",
  );
  assert(urls.every((url) => !url.includes(new URL(nextLink).hash.slice(1))));
  assert.equal(errors.length, 0, errors.join("\n"));
  await browser.close();
  console.log(
    `PASS ${width}: link creation/replay, anonymous review, immutable response/replay, history, revocation recovery, no secret in request URLs, viewport`,
  );
})().catch(async (e) => {
  console.error(e);
  if (auditPage) {
    console.error(await auditPage.locator("body").innerText());
    await auditPage.screenshot({
      path: "/workspace/attachments/acceptance-failure.png",
    });
  }
  process.exit(1);
});
