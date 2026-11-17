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
    await visit("executive-dashboard");
    await page
      .getByRole("heading", { name: "Sua operação hoje", exact: true })
      .waitFor();
    const nav = page.getByRole("navigation", {
      name: "Navegação principal no celular",
    });
    assert.equal(await nav.getByRole("button").count(), 5);
    assert.equal(
      await nav
        .getByRole("button", { name: "Início", exact: true })
        .getAttribute("aria-current"),
      "page",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.equal(
      await page
        .locator("header.nexo-topbar")
        .evaluate((node) => node.getBoundingClientRect().height <= 76),
      true,
    );
    await nav.getByRole("button", { name: "Mais", exact: true }).click();
    await page.getByRole("dialog", { name: "Mais opções" }).waitFor();
    await page.keyboard.press("Escape");
    await page
      .getByRole("dialog", { name: "Mais opções" })
      .waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await page.getByRole("dialog", { name: "Buscar", exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await page
      .getByRole("dialog", { name: "Buscar", exact: true })
      .waitFor({ state: "hidden" });
    await page
      .getByRole("navigation", { name: "Ações rápidas" })
      .getByRole("button", { name: "Cliente", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Novo Cliente", exact: true })
      .waitFor();
    assert.equal(new URL(page.url()).searchParams.has("action"), false);
    await page.keyboard.press("Escape");
    await page.goBack();
    await page
      .getByRole("heading", { name: "Sua operação hoje", exact: true })
      .waitFor();
    for (const [label, title] of [
      ["Agendar", "Novo agendamento"],
      ["Nova O.S.", "Nova O.S."],
      ["Cobrar", "Nova cobrança"],
    ]) {
      await page
        .getByRole("navigation", { name: "Ações rápidas" })
        .getByRole("button", { name: label, exact: true })
        .click();
      await page.getByRole("dialog", { name: title, exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await page.goBack();
      await page
        .getByRole("heading", { name: "Sua operação hoje", exact: true })
        .waitFor();
    }
    if (width === 390)
      await page.screenshot({
        path: "/workspace/attachments/nexo-home-mobile.png",
        fullPage: false,
        animations: "disabled",
      });
    console.log(
      "home/header/tabs/menu/search/4 real creation shortcuts",
      width,
      "passed",
    );
  }
  for (const currentRole of ["STAFF", "VIEWER", "MANAGER"]) {
    role = currentRole;
    await visit("executive-dashboard");
    const nav = page.getByRole("navigation", {
      name: "Navegação principal no celular",
    });
    if (currentRole === "MANAGER")
      assert.equal(
        await nav
          .getByRole("button", { name: "Financeiro", exact: true })
          .isVisible(),
        true,
      );
    else {
      assert.equal(
        await nav
          .getByRole("button", { name: "Financeiro", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await nav
          .getByRole("button", { name: "O.S.", exact: true })
          .isVisible(),
        true,
      );
      assert.equal(
        await page
          .getByRole("navigation", { name: "Ações rápidas" })
          .getByRole("button", { name: "Cobrar", exact: true })
          .count(),
        0,
      );
    }
    if (currentRole === "VIEWER") {
      assert.equal(
        await page.getByRole("navigation", { name: "Ações rápidas" }).count(),
        0,
      );
      await visit("appointments?action=create&customerId=customer-1");
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.equal(
        new URL(page.url()).searchParams.get("customerId"),
        "customer-1",
      );
    }
    console.log("role", currentRole, "passed");
  }
  role = "ADMIN";
  await visit("customers?customerId=customer-1");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  const searchDialog = page.getByRole("dialog", {
    name: "Buscar",
    exact: true,
  });
  await searchDialog.getByRole("textbox").fill("Cliente");
  await searchDialog
    .getByRole("button")
    .filter({ hasText: name })
    .first()
    .click();
  await searchDialog.waitFor({ state: "hidden" });
  console.log("search selects current route and closes passed");
  role = "ADMIN";
  await visit("executive-dashboard");
  await page
    .getByRole("navigation", { name: "Navegação principal no celular" })
    .getByRole("button", { name: "Mais", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ativar tema claro", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "Mais opções" })
    .waitFor({ state: "hidden" });
  assert.equal(
    await page.locator(".app-root").getAttribute("data-theme"),
    "light",
  );
  assert.equal(
    await page
      .locator(".mobile-app-nav")
      .evaluate(
        (node) => getComputedStyle(node).backgroundColor === "rgba(0, 0, 0, 0)",
      ),
    false,
  );
  await page.screenshot({
    path: "/workspace/attachments/nexo-home-mobile-claro.png",
    fullPage: false,
    animations: "disabled",
  });
  console.log("light theme passed");
  role = "ADMIN";
  homeMissing = true;
  await visit("executive-dashboard");
  await page.getByText("Não informado", { exact: true }).first().waitFor();
  assert(
    !(await page.locator(".mobile-home-summary").innerText()).includes("R$ 0"),
  );
  homeEmpty = true;
  await visit("executive-dashboard");
  await page.getByRole("heading", { name: "Organize sua operação" }).waitFor();
  homeEmpty = false;
  homeMissing = false;
  await page.setViewportSize({ width: 1366, height: 900 });
  await visit("executive-dashboard");
  await page
    .getByRole("heading", { name: "Operação hoje", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("navigation", { name: "Navegação principal no celular" })
      .count(),
    0,
  );
  assert.deepEqual(writes, []);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASSED: responsive shell, navigation, permissions, missing values, empty state, desktop, no writes",
  );
})().catch(async (error) => {
  console.error(error);
  if (page) {
    console.log((await page.locator("body").innerText()).slice(0, 3000));
    await page.context().browser()?.close();
  }
  process.exitCode = 1;
});
