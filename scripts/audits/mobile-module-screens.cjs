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
    const out = names.map((n) => {
      let data = [];
      switch (n) {
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
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [path, title, action] of [
      ["customers", "Clientes", "Novo cliente"],
      ["appointments", "Agenda", "Novo agendamento"],
      ["service-orders", "Serviços", "Nova O.S."],
      ["finances", "Financeiro", "Nova cobrança"],
    ]) {
      await visit(path);
      await page
        .getByRole("heading", { name: title, exact: true, level: 1 })
        .and(page.locator(":visible"))
        .waitFor();
      await page
        .getByRole("button", { name: action, exact: true })
        .and(page.locator(":visible"))
        .first()
        .waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        path + " overflow",
      );
      assert.equal(
        await page
          .locator(".mobile-module-header")
          .evaluate((node) => node.getBoundingClientRect().height < 180),
        true,
        path + " header size",
      );
      assert.equal(
        await page
          .locator(".module-list-item")
          .and(page.locator(":visible"))
          .first()
          .evaluate((node) => getComputedStyle(node).borderTopWidth === "0px"),
        true,
        path + " card chrome",
      );
      if (path === "customers") {
        const detail = page.locator(".module-row-details").first();
        assert.equal(await detail.getAttribute("open"), null);
        await detail.locator("summary").click();
        await detail.getByText(/Próximo agendamento/).waitFor();
        await detail.locator("summary").click();
        await page
          .getByRole("button", { name: "Ver cliente", exact: true })
          .first()
          .click();
        await page
          .getByRole("button", { name: "Voltar aos clientes", exact: true })
          .waitFor();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          "customer detail overflow",
        );
        await page
          .getByRole("button", { name: "Voltar aos clientes", exact: true })
          .click();
      }
      if (width === 390)
        await page.screenshot({
          path: "/workspace/attachments/" + path + "-app-mobile.png",
          fullPage: false,
          animations: "disabled",
        });
      console.log(path, width, "header / cards / overflow passed");
    }
  }
  role = "VIEWER";
  await visit("customers");
  await page
    .getByRole("heading", { name: "Clientes", exact: true, level: 1 })
    .and(page.locator(":visible"))
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Novo cliente", exact: true })
      .and(page.locator(":visible"))
      .count(),
    0,
  );
  await visit("appointments");
  await page
    .getByRole("heading", { name: "Agenda", exact: true, level: 1 })
    .and(page.locator(":visible"))
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Novo agendamento", exact: true })
      .and(page.locator(":visible"))
      .count(),
    0,
  );
  await visit("service-orders");
  await page
    .getByRole("heading", { name: "Serviços", exact: true, level: 1 })
    .and(page.locator(":visible"))
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Nova O.S.", exact: true })
      .and(page.locator(":visible"))
      .count(),
    0,
  );
  role = "ADMIN";
  await page.setViewportSize({ width: 1366, height: 900 });
  await visit("finances");
  await page.getByRole("table").first().waitFor();
  assert.equal(await page.getByRole("table").count(), 2);
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  await browser.close();
  console.log(
    "PASSED: all four modules, customer detail, read-only creation permissions, desktop, no writes",
  );
})().catch(async (error) => {
  console.error(error);
  if (page) {
    console.log((await page.locator("body").innerText()).slice(0, 2400));
    await page.context().browser()?.close();
  }
  process.exitCode = 1;
});
