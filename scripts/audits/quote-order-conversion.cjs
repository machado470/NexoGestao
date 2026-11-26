// Local-only: browser session/other module reads are simulated. Quote/catalog writes
// and public decisions use the real isolated Nest/PostgreSQL API.
const { chromium } = require("playwright");
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { PrismaClient } = require("../../apps/api/node_modules/@prisma/client");
const db = new PrismaClient({
  datasources: { db: { url: "postgresql://nexo@127.0.0.1:55439/postgres" } },
});
let auditPage;
(async () => {
  const fixture = JSON.parse(
      fs.readFileSync("/dev/shm/nexo-commerce-fixture.json", "utf8"),
    ),
    width = Number(process.env.MOBILE_WIDTH || 390),
    writes = [],
    errors = [];
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    isMobile: width < 768,
    hasTouch: width < 768,
  });
  await context.addInitScript(
    (theme) => localStorage.setItem("theme", theme),
    process.env.AUDIT_THEME || "dark",
  );
  const headers = { "x-audit-org": fixture.orgId, "x-audit-role": "MANAGER" },
    suffix = `${width}-${Date.now()}`;
  const services = [];
  for (const [i, price] of [
    [1, 15000],
    [2, null],
  ]) {
    const response = await context.request.post(
      "http://127.0.0.1:55440/service-catalog",
      {
        headers,
        data: {
          code: `Q-${i}-${suffix}`,
          name: `Serviço ${i} ${suffix}`,
          description:
            "Visita e avaliação do equipamento com escopo registrado.",
          priceCents: price,
          durationMinutes: 60,
          expectedCurrency: "BRL",
          entryKey: require("node:crypto").randomUUID(),
        },
      },
    );
    assert.equal(response.status(), 201);
    services.push(await response.json());
  }
  let convertedOrder = null,
    loseConvert = true;
  const orders = new Map();
  let loseCreate = true,
    loseShare = true,
    loseResponse = true;
  async function setup(page, roleRef) {
    page.setDefaultTimeout(30000);
    page.on("pageerror", (e) => errors.push(e.message));
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
            "serviceOrders.checklist",
            "serviceOrders.evidence",
            "serviceAcceptance.list",
          ].includes(name)
        ) {
          const end =
            name === "serviceOrders.returns"
              ? "returns?page=" + (input.page ?? 1)
              : name === "serviceOrders.checklist"
                ? "checklist"
                : name === "serviceOrders.evidence"
                  ? "evidence"
                  : "acceptances";
          const response = await page.request.get(
            `http://127.0.0.1:55440/service-orders/${input.serviceOrderId}/${end}`,
            {
              headers: {
                "x-audit-org": fixture.orgId,
                "x-audit-role": roleRef.role || "VIEWER",
              },
            },
          );
          assert(response.ok());
          out.push({ result: { data: { json: await response.json() } } });
          continue;
        }
        if (
          name.startsWith("serviceQuotes.") ||
          name === "serviceCatalog.list"
        ) {
          const op = name.split(".")[1],
            publicCall = op === "view" || op === "respond";
          let path = "/service-quotes";
          if (op === "orderOrigin")
            path = `/service-orders/${input.serviceOrderId}/quote-origin`;
          else if (name === "serviceCatalog.list")
            path = `/service-catalog?page=${input.page}&q=${encodeURIComponent(input.q)}&state=${input.state}`;
          else if (publicCall) path = "/quote-approval/" + op;
          else if (op === "list") path += `?page=${input.page}`;
          else if (op === "detail") path += `/${input.id}?page=${input.page}`;
          else if (op === "revoke")
            path += `/${input.id}/approvals/${input.linkId}/revoke`;
          else if (op !== "create") path += `/${input.id}/${op}`;
          const { id, linkId, ...body } = input;
          const response = await page.request.fetch(
            "http://127.0.0.1:55440" + path,
            {
              method: req.method(),
              headers: publicCall
                ? {}
                : {
                    "x-audit-org": fixture.orgId,
                    "x-audit-role": roleRef.role || "VIEWER",
                  },
              ...(req.method() === "POST" ? { data: body } : {}),
            },
          );
          let data = await response.json(),
            failed = !response.ok();
          if (op === "orderOrigin" && !failed) data = data.origin;
          if (op === "convert" && !failed) {
            convertedOrder = data;
            const raw = await db.serviceOrder.findFirst({
              where: { id: data.serviceOrderId, orgId: fixture.orgId },
            });
            assert(raw);
            const { billingTreatment, ...publicOrder } = raw;
            orders.set(data.serviceOrderId, {
              ...publicOrder,
              customer: fixture.customer,
              assignedTo: null,
              appointment: null,
              financialSummary: { hasCharge: false },
              operationalDecision: {
                isOverdue: false,
                overdueDays: 0,
                isStalled: false,
                chargeOverdue: false,
                operationalStatus: "ATENÇÃO",
                priority: "P1",
                riskLabel: "Sem responsável",
                nextAction: {
                  type: "edit",
                  label: "Definir responsável",
                  reason: "Sem responsável",
                },
              },
            });
          }
          if (req.method() === "POST") {
            writes.push({ op, input });
            if (
              !failed &&
              ((op === "create" && loseCreate) ||
                (op === "share" && loseShare) ||
                (op === "respond" && loseResponse) ||
                (op === "convert" && loseConvert))
            ) {
              if (op === "create") loseCreate = false;
              if (op === "share") loseShare = false;
              if (op === "respond") loseResponse = false;
              if (op === "convert") loseConvert = false;
              failed = true;
              data = { message: "Resposta perdida após registrar" };
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
        if (name === "finance.charges.pay") {
          const response = await page.request.post("http://127.0.0.1:55440/audit/payment", {
            headers,
            data: input,
          });
          assert(response.ok(), await response.text());
          writes.push({ op: "pay", input });
          out.push({ result: { data: { json: await response.json() } } });
          continue;
        }
        if (name === "finance.charges.getById" || name === "finance.charges.list") {
          const rows = await db.charge.findMany({
            where: { orgId: fixture.orgId, serviceOrderId: convertedOrder?.serviceOrderId ?? "" },
            include: { customer: true },
          });
          const charges = rows.map(charge => ({
            ...charge,
            balanceCents: charge.status === "PAID" ? 0 : charge.amountCents,
          }));
          out.push({ result: { data: { json: name.endsWith(".list") ? charges : charges.find(charge => charge.id === input.id) ?? null } } });
          continue;
        }
        if (["executions.start", "executions.complete", "executions.listByServiceOrder"].includes(name)) {
          const op = name.split(".")[1];
          const response = await page.request.post(
            `http://127.0.0.1:55440/audit/execution/${op}`,
            { headers, data: input },
          );
          assert(response.ok(), await response.text());
          if (op !== "listByServiceOrder") {
            writes.push({ op, input });
            const id = input.serviceOrderId ?? input.executionId;
            const persisted = await db.serviceOrder.findUniqueOrThrow({ where: { id } });
            const hasCharge = Boolean(await db.charge.count({
              where: { orgId: fixture.orgId, serviceOrderId: id },
            }));
            Object.assign(orders.get(id), {
              status: persisted.status,
              financialSummary: { hasCharge },
            });
          }
          out.push({ result: { data: { json: await response.json() } } });
          continue;
        }
        assert(req.method() !== "POST", "Unexpected write " + name);
        const selectedId = new URL(page.url()).searchParams.get("id");
        const current = orders.get(input.id || selectedId) || fixture.order;
        const data =
          {
            "serviceOrders.getById": current,
            "serviceOrders.page": {
              items: [current],
              meta: { page: 1, pages: 1, total: 1, limit: 8 },
            },
            "serviceOrders.list": Array.from(orders.values()),
            "customers.list": [fixture.customer],
            "session.me": {
              user: roleRef.role
                ? {
                    id: fixture.actor,
                    organizationId: fixture.orgId,
                    name: "Gestora",
                    email: "local@example.test",
                    role: roleRef.role,
                  }
                : null,
              requiresOnboarding: false,
            },
            "auth.me": roleRef.role
              ? { id: fixture.actor, role: roleRef.role }
              : null,
            "settings.displayPreferences": {
              timezone: "America/Sao_Paulo",
              currency: "BRL",
            },
            "customers.page": {
              items: [fixture.customer],
              meta: { page: 1, pages: 1, total: 1, limit: 20 },
            },
            "dashboard.notificationCenter.list": { items: [], unreadCount: 0 },
          }[name] ?? [];
        out.push({ result: { data: { json: data } } });
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(out),
      });
    });
  }
  const page = await context.newPage(),
    role = { role: "MANAGER" };
  auditPage = page;
  await setup(page, role);
  await page.goto("http://localhost:5173/quotes");
  const consent = page.getByRole("button", {
    name: "Somente essenciais",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  await page
    .getByRole("button", { name: "Novo orçamento", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
      name: "Novo orçamento",
      exact: true,
    }),
    title = `Orçamento ${suffix}`;
  await editor
    .getByRole("combobox", { name: "Cliente do orçamento", exact: true })
    .click();
  await page
    .getByRole("option", { name: fixture.customer.name, exact: true })
    .click();
  await editor.getByLabel("Título do orçamento", { exact: true }).fill(title);
  for (const source of services) {
    await editor
      .getByLabel("Buscar serviço no catálogo", { exact: true })
      .fill(source.code);
    await editor
      .getByRole("combobox", {
        name: "Adicionar serviço ao orçamento",
        exact: true,
      })
      .click();
    await page
      .getByRole("option", {
        name: new RegExp(source.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      })
      .click();
  }
  await editor.getByLabel("Quantidade", { exact: true }).nth(0).fill("2");
  await editor
    .getByLabel("Preço unitário (BRL)", { exact: true })
    .nth(1)
    .fill("50,00");
  await editor
    .getByLabel("Condições que serão compartilhadas", { exact: true })
    .fill("Atendimento em horário comercial. Pagamento após a execução.");
  const save = editor.getByRole("button", {
    name: "Salvar orçamento",
    exact: true,
  });
  await save.evaluate((node) => {
    node.click();
    node.click();
  });
  await editor
    .getByText("Resposta perdida após registrar", { exact: true })
    .waitFor();
  assert.equal(writes.filter((x) => x.op === "create").length, 1);
  await save.click();
  await editor.waitFor({ state: "hidden" });
  const creates = writes.filter((x) => x.op === "create");
  assert.equal(creates.length, 2);
  assert.equal(creates[0].input.entryKey, creates[1].input.entryKey);
  const card = page.getByRole("article", { name: title, exact: true });
  await card.waitFor();
  await card.getByText(/350,00/).waitFor();
  await card
    .getByRole("button", { name: "Ver orçamento", exact: true })
    .click();
  const detail = page.getByRole("dialog", {
    name: "Detalhe do orçamento",
    exact: true,
  });
  await detail
    .getByRole("button", { name: "Gerar link de aprovação", exact: true })
    .click();
  await detail
    .getByText("Resposta perdida após registrar", { exact: true })
    .waitFor();
  await detail
    .getByRole("button", { name: "Gerar link de aprovação", exact: true })
    .click();
  const firstUrl = await detail
    .getByLabel("Link privado do orçamento", { exact: true })
    .inputValue();
  const shares = writes.filter((x) => x.op === "share");
  assert.equal(shares.length, 2);
  assert.equal(shares[0].input.entryKey, shares[1].input.entryKey);
  assert(firstUrl.includes("/quote-approval#"));
  assert(!firstUrl.includes("?"));
  const clientConsole = [];
  const client = await context.newPage();
  client.on("console", (msg) => clientConsole.push(msg.text()));
  await setup(client, { role: null });
  await client.goto(firstUrl);
  await client
    .getByRole("heading", { name: "Conferir orçamento", exact: true })
    .waitFor();
  await client.getByText(/Total:.*350,00/).waitFor();
  await client
    .getByLabel("Seu nome", { exact: true })
    .fill("Cliente da auditoria");
  await client
    .getByLabel("Recusar e explicar o motivo", { exact: true })
    .check();
  await client
    .getByLabel("Motivo da recusa", { exact: true })
    .fill("Solicito alterar o horário e revisar o valor da visita.");
  await client
    .getByLabel(
      "Li os itens, valores e condições e confirmo a decisão selecionada.",
      { exact: true },
    )
    .check();
  await client
    .getByRole("button", { name: "Confirmar recusa", exact: true })
    .click();
  await client
    .getByText("Resposta perdida após registrar", { exact: true })
    .waitFor();
  await client
    .getByRole("button", { name: "Confirmar recusa", exact: true })
    .click();
  await client
    .getByRole("heading", { name: "Recusa registrada", exact: true })
    .waitFor();
  const answers = writes.filter((x) => x.op === "respond");
  assert.equal(answers[0].input.responseKey, answers[1].input.responseKey);
  await detail.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.reload();
  await card.getByText("Recusado por link", { exact: true }).waitFor();
  await card
    .getByRole("button", { name: "Ver orçamento", exact: true })
    .click();
  await detail
    .getByRole("button", { name: "Revisar orçamento", exact: true })
    .click();
  const revision = page.getByRole("dialog", {
    name: "Revisar orçamento",
    exact: true,
  });
  await revision
    .getByLabel("Condições que serão compartilhadas", { exact: true })
    .fill(
      "Atendimento no sábado, conforme solicitação do cliente. Pagamento após execução.",
    );
  await revision
    .getByLabel("Preço unitário (BRL)", { exact: true })
    .nth(0)
    .fill("175,00");
  await revision
    .getByLabel("Motivo da revisão", { exact: true })
    .fill("Horário e valor revisados após recusa do cliente.");
  await revision
    .getByRole("button", { name: "Salvar orçamento", exact: true })
    .click();
  await revision.waitFor({ state: "hidden" });
  await card.getByText(/400,00/).waitFor();
  await card
    .getByRole("button", { name: "Ver orçamento", exact: true })
    .click();
  await detail
    .getByRole("button", { name: "Gerar link de aprovação", exact: true })
    .click();
  const secondUrl = await detail
    .getByLabel("Link privado do orçamento", { exact: true })
    .inputValue();
  assert.notEqual(secondUrl, firstUrl);
  await client.goto(secondUrl);
  await client.getByText(/Total:.*400,00/).waitFor();
  await client
    .getByLabel("Seu nome", { exact: true })
    .fill("Cliente da auditoria");
  await client
    .getByLabel(
      "Li os itens, valores e condições e confirmo a decisão selecionada.",
      { exact: true },
    )
    .check();
  await client
    .getByRole("button", { name: "Confirmar aprovação", exact: true })
    .click();
  await client
    .getByRole("heading", { name: "Orçamento aprovado", exact: true })
    .waitFor();
  assert(
    await client.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  fs.mkdirSync("/workspace/attachments", { recursive: true });
  await client.screenshot({
    path: `/workspace/attachments/quote-approval-${width}.png`,
  });
  await detail.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.reload();
  await card.getByText("Aprovado por link", { exact: true }).waitFor();
  await card
    .getByRole("button", { name: "Ver orçamento", exact: true })
    .click();
  assert.equal(
    await detail
      .getByRole("button", { name: "Revisar orçamento", exact: true })
      .count(),
    0,
  );
  await detail.getByText("Histórico de versões", { exact: true }).click();
  await detail
    .getByText("Horário e valor revisados após recusa do cliente.", {
      exact: true,
    })
    .waitFor();
  await detail.getByText("Histórico de versões", { exact: true }).click();
  await detail.getByRole("button", { name: "Fechar", exact: true }).click();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `/workspace/attachments/service-quotes-${width}.png`,
  });
  await card
    .getByRole("button", { name: "Ver orçamento", exact: true })
    .click();
  await detail
    .getByRole("button", { name: "Criar O.S. desta versão", exact: true })
    .evaluate((node) => {
      node.click();
      node.click();
    });
  await detail
    .getByRole("button", { name: "Abrir O.S. vinculada", exact: true })
    .waitFor();
  assert.equal(writes.filter((x) => x.op === "convert").length, 1);
  assert(convertedOrder);
  const replay = await page.request.post(
    `http://127.0.0.1:55440/service-quotes/${convertedOrder.quoteId}/convert`,
    { headers, data: { expectedVersion: convertedOrder.quoteVersion } },
  );
  assert.equal(replay.status(), 201);
  assert.equal(
    (await replay.json()).serviceOrderId,
    convertedOrder.serviceOrderId,
  );
  assert.equal(
    await db.serviceQuoteOrder.count({
      where: { orgId: fixture.orgId, quoteId: convertedOrder.quoteId },
    }),
    1,
  );
  assert.equal(
    await db.charge.count({
      where: {
        orgId: fixture.orgId,
        serviceOrderId: convertedOrder.serviceOrderId,
      },
    }),
    0,
  );
  await detail
    .getByRole("button", { name: "Abrir O.S. vinculada", exact: true })
    .click();
  const origin = page.getByRole("region", {
    name: "Orçamento de origem",
    exact: true,
  });
  await origin.waitFor();
  await origin
    .getByText("Ver itens e condições aprovados", { exact: true })
    .click();
  await origin.getByText(/Total:.*400,00/).waitFor();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await origin.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `/workspace/attachments/quote-order-origin-${width}.png`,
  });
  await origin
    .getByRole("button", { name: "Ver orçamento de origem", exact: true })
    .click();
  await detail
    .getByRole("button", { name: "Abrir O.S. vinculada", exact: true })
    .waitFor();
  assert.equal(
    await detail
      .getByRole("button", { name: "Criar O.S. desta versão", exact: true })
      .count(),
    0,
  );
  await detail.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.goto("http://localhost:5173/quotes");
  await card.waitFor();
  // A new unsaved draft must be discardable without writing.
  await page
    .getByRole("button", { name: "Novo orçamento", exact: true })
    .click();
  await editor
    .getByLabel("Título do orçamento", { exact: true })
    .fill("Rascunho a descartar");
  await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
  const discard = page.getByRole("alertdialog");
  await discard
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  await editor.waitFor({ state: "hidden" });
  for (const next of ["STAFF", "VIEWER"]) {
    role.role = next;
    await page.reload();
    await card.waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Novo orçamento", exact: true })
        .count(),
      0,
    );
    await card
      .getByRole("button", { name: "Ver orçamento", exact: true })
      .click();
    assert.equal(
      await detail
        .getByRole("button", { name: "Gerar link de aprovação", exact: true })
        .count(),
      0,
    );
    await detail.getByRole("button", { name: "Fechar", exact: true }).click();
  }
  role.role = "MANAGER";
  await page.goto(`http://localhost:5173/service-orders?id=${convertedOrder.serviceOrderId}`);
  await page.getByRole("button", { name: "Iniciar execução", exact: true }).click();
  await page.getByRole("button", { name: "Concluir execução", exact: true }).click();
  await page.getByText("O.S. concluída.", { exact: true }).first().waitFor();
  const charges = await db.charge.findMany({
    where: { orgId: fixture.orgId, serviceOrderId: convertedOrder.serviceOrderId },
  });
  assert.equal(charges.length, 1);
  const [charge] = charges;
  assert.equal(charge.amountCents, 40000);
  assert.equal(charge.currency, "BRL");
  assert.equal((await db.serviceOrder.findUniqueOrThrow({
    where: { id: convertedOrder.serviceOrderId },
  })).status, "DONE");
  assert.equal(writes.filter(write => write.op === "start").length, 1);
  assert.equal(writes.filter(write => write.op === "complete").length, 1);
  await page.goto(`http://localhost:5173/finances?chargeId=${charge.id}&action=pay`);
  const paymentDialog = page.getByRole("dialog", { name: "Registrar pagamento manual" });
  await paymentDialog.getByLabel("Valor exato em centavos").waitFor();
  assert.equal(await paymentDialog.getByLabel("Valor exato em centavos").inputValue(), "40000");
  await paymentDialog.getByRole("button", { name: "Confirmar pagamento", exact: true }).click();
  await page.getByText("Pagamento confirmado pelo serviço financeiro.", { exact: true }).first().waitFor();
  assert.equal(writes.filter(write => write.op === "pay").length, 1);
  assert.equal((await db.charge.findUniqueOrThrow({ where: { id: charge.id } })).status, "PAID");
  const payments = await db.payment.findMany({ where: { orgId: fixture.orgId, chargeId: charge.id } });
  assert.equal(payments.length, 1);
  assert.equal(payments[0].amountCents, 40000);
  const tokens = [firstUrl.split("#")[1], secondUrl.split("#")[1]];
  const diagnostics = JSON.stringify(
    await client.evaluate(() => window.__NEXO_AUDIT__),
  );
  for (const token of tokens) {
    assert(
      !diagnostics.includes(token),
      "render diagnostics must omit bearer tokens",
    );
    assert(
      !clientConsole.join("\n").includes(token),
      "console diagnostics must omit bearer tokens",
    );
  }
  assert.equal(errors.length, 0, errors.join("\n"));
  await db.$disconnect();
  await browser.close();
  console.log(
    `PASS ${width}: approved quote to one order, execution, automatic charge, persisted manual payment, lost response/recovery, preserved terms, roles, viewport`,
  );
})().catch(async (e) => {
  console.error(e);
  if (auditPage) {
    console.error(await auditPage.locator("body").innerText());
    await auditPage.screenshot({
      path: "/workspace/attachments/quotes-failure.png",
    });
  }
  await db.$disconnect();
  process.exit(1);
});
