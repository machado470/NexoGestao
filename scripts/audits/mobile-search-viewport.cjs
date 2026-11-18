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
  let mode = "grouped",
    releaseSearch,
    searchStarted;
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
  await page.addInitScript(
    (theme) => localStorage.setItem("theme", theme),
    process.env.AUDIT_THEME || "dark",
  );
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
    const inputs = JSON.parse(
      new URL(req.url()).searchParams.get("input") || "{}",
    );
    if (names.includes("globalSearch.search") && mode === "gated")
      await new Promise((resolve) => {
        releaseSearch = resolve;
        searchStarted?.();
      });
    const out = names.map((n, index) => {
      if (n === "globalSearch.search") {
        if (mode === "error")
          return {
            error: {
              json: {
                message: "Busca indisponível",
                code: -32603,
                data: {
                  code: "INTERNAL_SERVER_ERROR",
                  httpStatus: 503,
                  path: n,
                },
              },
            },
          };
        const payload =
          mode === "empty"
            ? { ok: true, data: { customers: [], serviceOrders: [] } }
            : mode === "malformed"
              ? { ok: true, data: { wrong: [] } }
              : mode === "legacy"
                ? [
                    {
                      id: customer.id,
                      type: "customer",
                      title: customer.name,
                      route: "https://external.invalid",
                    },
                    {
                      id: charge.id,
                      type: "charge",
                      title: "Cobrança restrita",
                      route: "/finances?chargeId=" + charge.id,
                    },
                  ]
                : {
                    ok: true,
                    data: {
                      query: inputs[index]?.json?.query,
                      customers: { data: Array.from({ length: 20 }, (_, i) => ({ ...customer, id: `customer-${i}`, name: `Cliente resultado ${i}` })) },
                      serviceOrders: { items: [] },
                    },
                  };
        return { result: { data: { json: payload } } };
      }
      let data = [];
      switch (n) {
        case "unused.search":
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
        case "dashboard.notificationCenter.list":
          data = {
            items: [
              {
                id: "notice-1",
                title: "Abrir cliente da notificação",
                message: "Registro local",
                read: false,
                routeHint: "/customers?customerId=" + customer.id,
              },
            ],
            unreadCount: 1,
          };
          break;
        case "dashboard.notificationCenter.markAsRead":
          data = { ok: true };
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
  await page.goto("http://localhost:5173/customers");
  await page.getByText("Horários em America/Sao_Paulo", { exact: true }).waitFor();
  const consent = page.getByRole("button", { name: "Somente essenciais", exact: true });
  if (await consent.isVisible()) await consent.click();
  const noticeClose = page.getByRole("button", { name: "Fechar aviso", exact: true });
  if (await noticeClose.count()) {
    const handle = await noticeClose.first().elementHandle();
    await noticeClose.first().click();
    await page.waitForFunction(node => !node?.isConnected, handle);
  }
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Buscar", exact: true });
  const input = dialog.getByRole("textbox", { name: "Busca global", exact: true });
  await input.fill("cliente");
  const last = dialog.getByRole("button", { name: /^Cliente resultado 19/ });
  await last.waitFor();
  for (const height of [844, 420, 280]) {
    await page.setViewportSize({ width: Number(process.env.MOBILE_WIDTH || 390), height });
    await page.waitForFunction(height => {
      const box = document.querySelector('[role="dialog"]')?.getBoundingClientRect();
      return box && box.top >= 0 && box.bottom <= height + 1;
    }, height);
    const box = await dialog.boundingBox();
    assert(box && box.y >= 0 && box.y + box.height <= height + 1, `Search must fit ${height}px viewport: ${JSON.stringify(box)}`);
    const inputBox = await input.boundingBox();
    assert(inputBox.y >= box.y && inputBox.y + inputBox.height <= box.y + box.height);
    await last.scrollIntoViewIfNeeded();
    const lastBox = await last.boundingBox();
    assert(lastBox && lastBox.y >= 0 && lastBox.y + lastBox.height <= height, "Last result must be reachable");
    const close = dialog.getByRole("button", { name: "Close", exact: true });
    const closeBox = await close.boundingBox();
    assert(closeBox && closeBox.y >= 0 && closeBox.y + closeBox.height <= height, "Close must remain accessible");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `/workspace/attachments/search-height-${height}-${process.env.MOBILE_WIDTH || 390}.png`, animations: "disabled" });
  }
  // Simulate a keyboard that shrinks/pans VisualViewport without resizing layout.
  await page.setViewportSize({ width: Number(process.env.MOBILE_WIDTH || 390), height: 844 });
  await page.evaluate(() => {
    window.__searchVisualViewport = { height: 280, top: 90 };
    Object.defineProperty(visualViewport, "height", { configurable: true, get: () => window.__searchVisualViewport.height });
    Object.defineProperty(visualViewport, "offsetTop", { configurable: true, get: () => window.__searchVisualViewport.top });
    visualViewport.dispatchEvent(new Event("resize"));
  });
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.getBoundingClientRect().top >= 102);
  let visualBox = await dialog.boundingBox();
  assert(visualBox.y >= 90 && visualBox.y + visualBox.height <= 370);
  await page.evaluate(() => { window.__searchVisualViewport.top = 120; visualViewport.dispatchEvent(new Event("scroll")); });
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.getBoundingClientRect().top >= 132);
  visualBox = await dialog.boundingBox();
  assert(visualBox.y + visualBox.height <= 400);
  await page.evaluate(() => { delete visualViewport.height; delete visualViewport.offsetTop; visualViewport.dispatchEvent(new Event("resize")); });
  await last.click();
  await page.waitForURL("**/customers?customerId=customer-19");
  await dialog.waitFor({ state: "hidden" });
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  console.log("PASS", process.env.MOBILE_WIDTH || 390, "search fits changing viewport, input/close visible, last result reachable, navigation closes dialog");
  await browser.close();
})().catch(async error => { console.error(error); if (page) { await page.screenshot({path: "/workspace/attachments/search-viewport-failure.png"}); console.log((await page.locator("body").innerText()).slice(-2000)); } process.exit(1); });
