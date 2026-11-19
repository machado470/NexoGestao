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
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
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
    const out = await Promise.all(names.map(async (n, index) => {
      const input = encoded[index]?.json ?? encoded[index] ?? {};
      readInputs.push({ name: n, input });
      if (n === target) {
        calls++;
        if (mode === "first") {
          mode = "held";
          return { error: { json: { message: "Falha transitória", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 503, path: n } } } };
        }
        if (mode === "fail") return { error: { json: { message: "Fonte indisponível", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 503, path: n } } } };
        if (mode === "held") await new Promise(resolve => release = resolve);
      }
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
    }));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(out),
    });
  });

  let target, mode = "ok", calls = 0, release;
  page.setDefaultTimeout(12000);
  const cases = [
    ["governance.operationalState", "Carregando estado oficial", "Estado operacional indisponível", "Contrato de estado indisponível"],
    ["governance.autoScore", "Carregando avaliação oficial", "Avaliação indisponível", "Sem avaliação disponível"],
    ["governance.runs", "Carregando execuções oficiais", "Histórico indisponível", "Nenhuma execução registrada"],
    ["dashboard.operationalSignals", "Carregando sinais oficiais", "Sinais indisponíveis", "Nenhum sinal retornado"],
    ["dashboard.nextBestAction", "Carregando decisão oficial", "Decisão indisponível", "Sem recomendação ativa"],
  ];
  const waitHeld = async () => {
    for (let i = 0; !release && i < 1200; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert(release, "Read must reach held response");
  };
  for (const [source, loadingText, errorText, emptyText] of cases) {
    target = source; mode = "first"; calls = 0; release = undefined;
    await page.goto("http://localhost:5173/governance");
    await page.getByText("Horários em America/Sao_Paulo", { exact: true }).waitFor();
    const consent = page.getByRole("button", { name: "Somente essenciais", exact: true });
    if (await consent.isVisible()) await consent.click();
    await waitHeld();
    if (source === "governance.autoScore") await page.getByText("Avaliação automática", { exact: true }).click();
    if (source === "governance.runs") await page.getByText("Histórico de avaliações", { exact: true }).click();
    const loading = page.getByText(loadingText, { exact: true });
    const error = page.getByText(errorText, { exact: true });
    const empty = page.getByText(emptyText, { exact: true });
    const partial = page.getByText("Indisponibilidade parcial", { exact: true });
    await loading.waitFor(); assert.equal(calls, 2);
    assert.equal(await error.count(), 0); assert.equal(await empty.count(), 0);
    assert.equal(await partial.count(), 0);
    mode = "ok"; release(); release = undefined;
    await loading.waitFor({ state: "hidden" });
    assert.equal(await error.count(), 0);
    mode = "fail";
    await page.getByRole("button", { name: "Atualizar Governança", exact: true }).click();
    await error.waitFor(); await partial.waitFor();
    assert.equal(await empty.count(), 0);
    // Unaffected signals remain official and visible when another source fails.
    if (source !== "dashboard.operationalSignals") await page.getByText("Primeiro sinal recebido", { exact: true }).waitFor();
    mode = "held";
    const beforeRetry = readInputs.length;
    const retry = page.getByRole("button", { name: "Tentar novamente", exact: true }).first();
    await page.waitForFunction(node => node.getBoundingClientRect().height >= 44, await retry.elementHandle());
    await retry.click(); await waitHeld(); await loading.waitFor();
    assert.equal(await error.count(), 0); assert.equal(await empty.count(), 0); assert.equal(await partial.count(), 0);
    assert.deepEqual(readInputs.slice(beforeRetry).filter(item => cases.some(([key]) => key === item.name)).map(item => item.name), [source], "Retry only the failed source");
    mode = "ok"; release(); release = undefined;
    await loading.waitFor({ state: "hidden" });
    assert.equal(await error.count(), 0); assert.equal(await partial.count(), 0);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log("PASS", process.env.MOBILE_WIDTH || 390, source, "one transient retry, no false empty, independent source recovery");
  }
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  await browser.close();
})().catch(async error => { console.error(error); if (page) { console.log((await page.locator("body").innerText()).slice(-2400)); } process.exit(1); });
