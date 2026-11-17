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
    viewport: { width: 390, height: 844 },
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

  page.setDefaultTimeout(12000);
  await page.clock.setFixedTime(new Date("2026-11-17T15:00:00Z"));
  async function visit(path) {
    await page.goto("http://localhost:5173/" + path);
    await page
      .getByText("Horários em America/Sao_Paulo", { exact: true })
      .waitFor();
    const consent = page.getByRole("button", {
      name: "Somente essenciais",
      exact: true,
    });
    if (await consent.isVisible()) await consent.click();
  }
  async function noOverflow(label) {
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      label,
    );
  }
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await visit("audit");
    const records = page.getByRole("list", {
      name: "Registros de auditoria no celular",
    });
    await records.waitFor();
    assert.equal(
      await page.getByRole("table").and(page.locator(":visible")).count(),
      0,
    );
    assert((await records.innerText()).includes("09:00:17"));
    await records.getByRole("button").first().click();
    const modal = page.getByRole("dialog", {
      name: "Evidência do registro",
      exact: true,
    });
    await modal.waitFor();
    assert((await modal.innerText()).includes("UPDATED"));
    assert(!(await modal.innerText()).includes("secret-must-not-render"));
    await noOverflow("audit modal " + width);
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "Próxima", exact: true })
      .and(page.locator(":visible"))
      .click();
    await page
      .getByText("Registro da segunda página", { exact: true })
      .and(page.locator(":visible"))
      .waitFor();
    await noOverflow("audit " + width);
    if (width === 390) {
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        scrollTo({ top: 0, behavior: "instant" });
        document
          .querySelector("main")
          ?.scrollTo({ top: 0, behavior: "instant" });
      });
      await page.screenshot({
        path: "/workspace/attachments/auditoria-app-mobile.png",
        fullPage: false,
        animations: "disabled",
      });
    }
    await visit("timeline");
    const timeline = page.getByRole("list", { name: "Eventos da Timeline" });
    await timeline.waitFor();
    assert.deepEqual(
      await timeline.getByRole("heading", { level: 3 }).allTextContents(),
      ["Primeiro evento recebido", "Segundo evento recebido"],
    );
    await timeline.locator("details").first().locator("summary").click();
    await timeline.getByText(auditEvent.actorName, { exact: true }).waitFor();
    await timeline
      .getByText("Ver metadados da evidência", { exact: true })
      .first()
      .click();
    await timeline.getByText("Resultado", { exact: true }).waitFor();
    await page.getByLabel("Buscar nas evidências").fill("naoexiste");
    await page
      .getByText("Nenhum evento correspondente", { exact: true })
      .waitFor();
    await page.getByLabel("Buscar nas evidências").fill("");
    await timeline.waitFor();
    await noOverflow("timeline " + width);
    if (width === 390) {
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        scrollTo({ top: 0, behavior: "instant" });
        document
          .querySelector("main")
          ?.scrollTo({ top: 0, behavior: "instant" });
      });
      await page.screenshot({
        path: "/workspace/attachments/timeline-app-mobile.png",
        fullPage: false,
        animations: "disabled",
      });
    }
    await visit("governance");
    await page
      .getByRole("heading", {
        name: "Há pendências que precisam de acompanhamento.",
        exact: true,
      })
      .waitFor();
    const signals = page.getByRole("list", {
      name: "Sinais operacionais oficiais",
    });
    assert.equal(
      await signals.locator("li").and(page.locator(":visible")).count(),
      3,
    );
    await page
      .getByRole("button", { name: "Ver todos os sinais", exact: true })
      .click();
    assert.equal(
      await signals.locator("li").and(page.locator(":visible")).count(),
      5,
    );
    assert.deepEqual(
      await signals.getByRole("heading").allTextContents(),
      signalNames,
    );
    await page
      .getByRole("button", { name: "Mostrar menos sinais", exact: true })
      .click();
    await page
      .getByText("Avaliação automática", { exact: true })
      .and(page.locator(":visible"))
      .click();
    await page
      .getByText("Nota oficial:", { exact: false })
      .and(page.locator(":visible"))
      .waitFor();
    await page.getByText("Histórico de avaliações", { exact: true }).click();
    await page.getByText("Execução run-1", { exact: true }).waitFor();
    await noOverflow("governance " + width);
    if (width === 390) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: "/workspace/attachments/governanca-app-mobile.png",
        fullPage: false,
        animations: "disabled",
      });
    }
    console.log("audit / timeline / governance", width, "passed");
  }
  await visit("audit");
  await page.getByText("Filtrar registros", { exact: true }).click();
  await page.locator("#audit-from").fill("2026-11-17");
  await page.locator("#audit-to").fill("2026-11-17");
  const dateResponse = page.waitForResponse(
    (response) =>
      response.url().includes("audit.listEvents") &&
      response.url().includes("2026-11-17T03"),
  );
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await dateResponse;
  let input = readInputs
    .filter((item) => item.name === "audit.listEvents")
    .at(-1).input;
  assert.equal(input.from, "2026-11-17T03:00:00.000Z");
  assert.equal(input.to, "2026-11-18T02:59:59.999Z");
  await page.locator("#audit-from").fill("2026-11-18");
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Informe um período válido" })
    .waitFor();
  await page.locator("#audit-from").fill("2026-11-17");
  failingSources.add("audit.listEvents");
  await page
    .getByRole("button", { name: "Atualizar Auditoria", exact: true })
    .click();
  await page
    .getByText("Registros indisponíveis. Tente novamente acima.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await page.locator("#audit-from").inputValue(), "2026-11-17");
  failingSources.clear();
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .first()
    .click();
  await page
    .getByRole("list", { name: "Registros de auditoria no celular" })
    .waitFor();
  failingSources.add("governance.operationalState");
  await visit("governance");
  await page
    .getByText("Estado operacional indisponível", { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByText("Operação normal", { exact: true })
      .and(page.locator(":visible"))
      .count(),
    0,
  );
  failingSources.clear();
  role = "VIEWER";
  await visit("governance");
  await page.getByRole("button", { name: /^Abrir destino oficial:/ }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: /^Abrir destino oficial:/ })
      .isDisabled(),
    true,
  );
  const auditReads = readInputs.filter(
    (item) => item.name === "audit.listEvents",
  ).length;
  await page.goto("http://localhost:5173/audit");
  await page
    .getByRole("heading", { name: "Acesso restrito", exact: true })
    .waitFor();
  assert.equal(
    readInputs.filter((item) => item.name === "audit.listEvents").length,
    auditReads,
  );
  role = "ADMIN";
  failingSources.add("settings.displayPreferences");
  await page.goto("http://localhost:5173/audit");
  await page
    .getByRole("heading", { name: "Auditoria", exact: true, level: 1 })
    .and(page.locator(":visible"))
    .waitFor();
  await page.getByText("Filtrar registros", { exact: true }).click();
  await page.locator("#audit-from").fill("2026-11-17");
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Aguarde a confirmação do fuso da empresa" })
    .waitFor();
  failingSources.clear();
  await page.setViewportSize({ width: 1366, height: 900 });
  await visit("audit");
  await page.getByRole("table").waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  await browser.close();
  console.log(
    "PASSED: mobile evidence, pagination, metadata redaction, company timezone filter, error preservation, permissions, desktop, no writes",
  );
})().catch(async (error) => {
  console.error(error);
  if (page) {
    console.log((await page.locator("body").innerText()).slice(0, 3600));
    await page.context().browser()?.close();
  }
  process.exitCode = 1;
});
