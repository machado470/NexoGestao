// Run with Playwright installed and the local Vite server on port 5173.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
let page;
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  page = await browser.newPage({
    viewport: { width: Number(process.env.MOBILE_WIDTH || 390), height: 844 },
    timezoneId: "UTC",
    isMobile: true,
    hasTouch: true,
  });
  let emptyAppointments = false;
  let auditEmpty = false;
  const readInputs = [],
    failingSources = new Set();
  const personId = "00000000-0000-4000-8000-000000000001";
  const auditEvent = {
    id: "00000000-0000-4000-8000-000000000002",
    createdAt: "2026-11-17T12:00:17Z",
    actorName:
      "Responsável com Nome Muito Longo para Conferir a Leitura no Celular",
    actorPersonId: personId,
    action: "CUSTOMER_UPDATED",
    entityType: "Customer",
    entityId: "00000000-0000-4000-8000-000000000003",
    orgId: "org-1",
    context: "Alteração de cadastro registrada com sucesso.",
    metadata: {
      status: "UPDATED",
      attempts: 2,
      token: "secret-must-not-render",
    },
  };
  const timelineEvents = [
    {
      id: "00000000-0000-4000-8000-000000000004",
      eventType: "CUSTOMER_UPDATED",
      occurredAt: "2026-11-17T12:00:17Z",
      actor: { name: auditEvent.actorName },
      entity: {
        type: "customer",
        id: auditEvent.entityId,
        href: "/customers?customerId=" + auditEvent.entityId,
      },
      module: "customers",
      severity: null,
      title: "Primeiro evento recebido",
      description:
        "Cadastro atualizado, com evidência disponível para consulta.",
      consequence: null,
      recommendedAction: null,
      origin: "API",
      metadata: { status: "UPDATED", result: "CONFIRMED" },
    },
    {
      id: "00000000-0000-4000-8000-000000000005",
      eventType: "SERVICE_ORDER_COMPLETED",
      occurredAt: "2026-11-17T15:00:00Z",
      actor: null,
      entity: null,
      module: "service_orders",
      severity: null,
      title: "Segundo evento recebido",
      description: "Serviço concluído conforme registro da operação.",
      consequence: null,
      recommendedAction: null,
      origin: null,
      metadata: {},
    },
  ];
  const signalNames = [
    "Primeiro sinal recebido",
    "Segundo sinal recebido",
    "Terceiro sinal recebido",
    "Quarto sinal recebido",
    "Quinto sinal recebido",
  ];
  const governanceSignals = signalNames.map((title, index) => ({
    id: "signal-" + index,
    title,
    area: "FINANCE",
    severity: index === 1 ? "CRITICAL" : "WARNING",
    reason: "CHARGE_PENDING",
    summary: "Existe uma pendência registrada para conferência.",
    impact: "Recebimento pendente",
    source: "RISK_ENGINE",
    detectedAt: "2026-11-17T12:00:17Z",
  }));
  let role = "ADMIN",
    homeMissing = false,
    homeEmpty = false;
  const errors = [],
    writes = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("PAGE ERROR", e.message);
  });
  await page.addInitScript(theme => localStorage.setItem("theme", theme), process.env.AUDIT_THEME || "dark");
  const name =
    "Cliente de Serviços com Nome Muito Longo para Testar a Tela Pequena";
  const customer = {
    id: "customer-1",
    name,
    active: true,
    phone: "11999990000",
  };
  const appt = {
    id: "appt-1",
    customerId: customer.id,
    title: "Visita técnica de diagnóstico e manutenção",
    startsAt: "2026-11-20T12:00:00Z",
    endsAt: "2026-11-20T13:00:00Z",
    status: "SCHEDULED",
    assignedToPersonId: "person-1",
  };
  const order = {
    id: "order-1",
    number: "OS-001",
    title: "Serviço de diagnóstico com descrição longa",
    customerId: customer.id,
    status: "ASSIGNED",
    assignedToPersonId: "person-1",
    updatedAt: "2026-11-17T12:00:00Z",
    operationalDecision: {
      isOverdue: false,
      isStalled: false,
      operationalStatus: "NORMAL",
      priority: "P3",
    },
  };
  const charge = {
    id: "charge-1",
    customerId: customer.id,
    customer,
    serviceOrderId: order.id,
    serviceOrder: order,
    currency: "BRL",
    currency: "BRL",
    amountCents: 15000,
    paidAmountCents: 0,
    balanceCents: 15000,
    status: "PENDING",
    dueDate: "2026-11-20T12:00:00Z",
    updatedAt: "2026-11-17T12:00:00Z",
    financialOperationalSummary: {
      priority: "MEDIUM",
      riskLevel: "NORMAL",
      priorityReason: "Cobrança pendente de pagamento",
      recommendedAction: "REGISTER_PAYMENT",
      recommendedActionTarget: "CHARGE",
    },
  };
  const person = {
    personId: "person-1",
    id: "person-1",
    name: "Profissional com Nome Longo para Testar o Celular",
    role: "Técnico",
    status: "ACTIVE",
    email: "profissional.muito.longo@example.test",
    loadStatus: "NORMAL",
    capacityStatus: "UNDER_CAPACITY",
    availabilityStatus: "AVAILABLE",
    operationalStatus: "NORMAL",
    priority: "P3",
    openServiceOrdersCount: 1,
    overdueServiceOrdersCount: 0,
    futureAppointmentsCount: 1,
    todayAppointmentsCount: 0,
    dailyServiceOrderCapacity: 5,
    dailyAppointmentCapacity: 5,
    serviceOrderCapacityUsagePct: 20,
    appointmentCapacityUsagePct: 20,
  };
  await page.route("**/api/consent", (r) =>
    r.fulfill({ contentType: "application/json", body: '{"success":true}' }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const req = route.request(),
      names = new URL(req.url()).pathname.split("/api/trpc/")[1].split(",");
    if (req.method() === "POST") writes.push(...names);
    const encoded = JSON.parse(
      new URL(req.url()).searchParams.get("input") || "{}",
    );
    const out = names.map((n, index) => {
      const input = encoded[index]?.json ?? encoded[index] ?? {};
      readInputs.push({ name: n, input });
      if (failingSources.has(n))
        return {
          error: {
            json: {
              message: "Falha simulada da fonte",
              code: -32603,
              data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500, path: n },
            },
          },
        };
      let data = [];
      switch (n) {
        case "audit.listEvents":
          data = {
            data: auditEmpty
              ? []
              : [
                  {
                    ...auditEvent,
                    context:
                      input.page === 2
                        ? "Registro da segunda página"
                        : auditEvent.context,
                  },
                ],
            pagination: {
              page: input.page || 1,
              limit: 25,
              total: auditEmpty ? 0 : 26,
              pages: auditEmpty ? 0 : 2,
            },
          };
          break;
        case "audit.getSummary":
          data = {
            total: 26,
            byAction: [{ action: "CUSTOMER_UPDATED", count: 26 }],
            byActor: [
              {
                actorPersonId: personId,
                actorName: auditEvent.actorName,
                count: 26,
              },
            ],
          };
          break;
        case "people.list":
          data = [{ id: personId, name: auditEvent.actorName, active: true }];
          break;
        case "timeline.listByOrg":
          data = timelineEvents;
          break;
        case "governance.operationalState":
          data = {
            operationalState: "WARNING",
            reason: "Há pendências que precisam de acompanhamento.",
            source: "GOVERNANCE_RUN",
            evidenceAt: "2026-11-17T12:00:17Z",
            evaluatedRecords: 26,
            availability: "AVAILABLE",
          };
          break;
        case "governance.autoScore":
          data = {
            score: 76,
            level: "B",
            lastUpdated: "2026-11-17T12:00:17Z",
            source: "GOVERNANCE_RUN",
            availability: "AVAILABLE",
            reason: null,
            factors: [
              {
                name: "Registros conferidos",
                value: 26,
                reference: "Avaliação concluída",
              },
            ],
          };
          break;
        case "governance.runs":
          data = [
            {
              id: "run-1",
              orgId: "org-1",
              evaluated: 26,
              warnings: 1,
              correctives: 0,
              institutionalRiskScore: 40,
              restrictedCount: 0,
              suspendedCount: 0,
              openCorrectivesCount: 0,
              durationMs: 100,
              startedAt: "2026-11-17T12:00:00Z",
              finishedAt: "2026-11-17T12:00:17Z",
              createdAt: "2026-11-17T12:00:00Z",
              bucket: "Avaliação diária",
            },
          ];
          break;
        case "dashboard.operationalSignals":
          data = { signals: governanceSignals };
          break;
        case "globalSearch.search":
          data = [
            {
              id: customer.id,
              type: "customer",
              title: customer.name,
              subtitle: "Cliente",
              route: "/customers?customerId=" + customer.id,
            },
          ];
          break;
        case "dashboard.kpis":
          data = homeMissing
            ? {}
            : {
                netWeeklyRevenueInCents: 15000,
                weeklyRevenueInCents: 15000,
                openServiceOrders: 4,
                comparison: {},
              };
          break;
        case "dashboard.alerts":
          data = { operationalQueue: [] };
          break;
        case "dashboard.executivePipeline":
          data = { stages: [] };
          break;
        case "dashboard.operationalState":
          data = {
            dashboardState: homeEmpty ? "EMPTY" : "HEALTHY",
            operationalState: "NORMAL",
            source: "PERSISTED_OPERATIONAL_STATE",
            evidenceAt: null,
          };
          break;
        case "dashboard.operationalSignals":
          data = { signals: [] };
          break;
        case "dashboard.nextBestAction":
          data = {
            source: "RISK_ENGINE",
            signalId: "signal-1",
            actionType: "REVIEW_CHARGE",
            entityType: "charge",
            entityId: "charge-1",
            serviceOrderId: null,
            messageId: null,
            detectedAt: "2026-11-17T12:00:17Z",
            metadata: {},
            title: "Revisar cobrança pendente",
            reason: "Há um pagamento a conferir.",
            impact: "Recebimento pendente",
            area: "FINANCE",
            chargeId: "charge-1",
            suggestedAction: "Ver cobrança",
            routeHint: "/finances?chargeId=charge-1",
          };
          break;
        case "settings.displayPreferences":
          data = { timezone: "America/Sao_Paulo", currency: "USD" };
          break;
        case "session.me":
          data = {
            user: {
              id: "user-1",
              organizationId: "org-1",
              name: "Admin",
              email: "admin@example.test",
              role,
            },
            requiresOnboarding: false,
          };
          break;
        case "customers.page":
          data = {
            items: [customer],
            pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
            meta: { page: 1, limit: 8, total: 1, pages: 1 },
          };
          break;
        case "customers.operationalSummaryPage":
          data = {
            customers: [],
            portfolio: {
              operationalStatus: "NORMAL",
              riskCustomers: 0,
              criticalCustomers: 0,
            },
          };
          break;
        case "customers.list":
          data = [customer];
          break;
        case "people.assignees":
          data = [person];
          break;
        case "people.operationalSummary":
          data = { people: [person] };
          break;
        case "appointments.page":
          data = {
            items: emptyAppointments ? [] : [appt],
            meta: { page: 1, limit: 8, total: 1, pages: 1 },
          };
          break;
        case "appointments.list":
          data = [appt];
          break;
        case "serviceOrders.page":
          data = {
            items: [order],
            meta: { page: 1, limit: 8, total: 1, pages: 1 },
          };
          break;
        case "serviceOrders.list":
          data = [order];
          break;
        case "finance.charges.list":
          data = { items: [charge], pagination: { total: 1 } };
          break;
        case "finance.charges.stats":
          data = {
            currencies: ["BRL"],
            pending: { amountCents: 15000, count: 1 },
            paid: { amountCents: 0, count: 0 },
            overdue: { amountCents: 0, count: 0 },
          };
          break;
        case "finance.operationalQueue":
          data = [charge];
          break;
        case "timeline.listByOrg":
          data = { events: [] };
          break;
      }
      return { result: { data: { json: data } } };
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(out),
    });
  });

  page.setDefaultTimeout(15000);
  const width = Number(process.env.MOBILE_WIDTH || 390);
  const visit = async path => {
    await page.goto("http://localhost:5173/" + path);
    await page.getByText("Horários em America/Sao_Paulo", { exact: true }).waitFor();
    const consent = page.getByRole("button", { name: "Somente essenciais", exact: true });
    if (await consent.isVisible()) await consent.click();
  };
  const controls = async () => {
    const fields = page.locator('.module-filters input, .module-filters select, .module-filters [role="combobox"]');
    for (const field of await fields.all()) {
      if (!await field.isVisible()) continue;
      const box = await field.boundingBox();
      if (await field.evaluate(node => node.tagName === "SELECT" || node.getAttribute("type") === "date")) {
        assert.equal(await field.evaluate(node => getComputedStyle(node).colorScheme), process.env.AUDIT_THEME || "dark");
      }
      assert(box.x >= 0 && box.x + box.width <= width + 1);
      if (width < 768) {
        assert(box.height >= 44, `Control height ${box.height}`);
        assert.equal(await field.evaluate(node => getComputedStyle(node).fontSize), "16px");
      }
    }
    if (width < 768) for (const button of await page.locator('.module-filters button').all()) if (await button.isVisible()) assert((await button.boundingBox()).height >= 44);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  };
  await visit("timeline");
  await page.getByRole("list", { name: "Eventos da Timeline" }).waitFor();
  if (width < 768) await page.getByText("Mais filtros", { exact: true }).click();
  await controls();
  await page.getByRole("combobox", { name: "Tipo de evento", exact: true }).click();
  await page.getByRole("option", { name: "Cliente atualizado", exact: true }).click();
  await page.getByRole("listbox").waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("list", { name: "Eventos da Timeline" }).locator(':scope > li').count(), 1);
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  assert.equal(await page.getByRole("list", { name: "Eventos da Timeline" }).locator(':scope > li').count(), 2);
  await visit("audit");
  await page.getByRole("list", { name: "Registros de auditoria no celular" }).waitFor({ state: width < 768 ? "visible" : "hidden" });
  if (width < 768) await page.getByText("Filtrar registros", { exact: true }).click();
  await page.locator("#audit-actor option").nth(1).waitFor({ state: "attached" });
  await controls();
  for (const id of ["audit-actor", "audit-action"]) {
    const ratio = await page.locator('#' + id).evaluate(node => {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1; const ctx = canvas.getContext("2d");
      ctx.fillStyle = getComputedStyle(node).backgroundColor; ctx.fillRect(0, 0, 1, 1); const bg = [...ctx.getImageData(0, 0, 1, 1).data];
      ctx.fillStyle = getComputedStyle(node).color; ctx.fillRect(0, 0, 1, 1); const fg = [...ctx.getImageData(0, 0, 1, 1).data];
      const lum = rgb => rgb.slice(0, 3).map(v => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      return (Math.max(lum(bg), lum(fg)) + .05) / (Math.min(lum(bg), lum(fg)) + .05);
    });
    assert(ratio >= 4.5, `Select contrast ${ratio}`);
  }
  await page.locator("#audit-actor").selectOption(personId);
  await page.locator("#audit-action").selectOption("CUSTOMER_UPDATED");
  await page.locator("#audit-from").fill("2026-11-17");
  const filtered = page.waitForResponse(response => response.url().includes("audit.listEvents") && decodeURIComponent(response.url()).includes("CUSTOMER_UPDATED"));
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click(); await filtered;
  const input = readInputs.filter(item => item.name === "audit.listEvents").at(-1).input;
  assert.equal(input.actorPersonId, personId); assert.equal(input.action, "CUSTOMER_UPDATED"); assert.equal(input.from, "2026-11-17T03:00:00.000Z");
  await controls();
  await page.screenshot({ path: `/workspace/attachments/evidence-filters-${width}-${process.env.AUDIT_THEME || "dark"}.png`, fullPage: true });
  await page.getByRole("button", { name: "Limpar", exact: true }).click();
  assert.equal(await page.locator("#audit-actor").inputValue(), ""); assert.equal(await page.locator("#audit-action").inputValue(), ""); assert.equal(await page.locator("#audit-from").inputValue(), "");
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  console.log("PASS", width, process.env.AUDIT_THEME || "dark", "filter controls fit, mobile 44px/16px, select contrast, Timeline filter/reset, audit actor/action/date payload and reset");
  await browser.close();
})().catch(async error => { console.error(error); if (page) console.log((await page.locator("body").innerText()).slice(-1800)); process.exit(1); });
