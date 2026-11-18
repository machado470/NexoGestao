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
                      customers: { data: [customer] },
                      serviceOrders: { items: [order] },
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

  page.setDefaultTimeout(15000);
  await page.goto("http://localhost:5173/customers");
  const consent = page.getByRole("button", {
    name: "Somente essenciais",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  const dialog = page.getByRole("dialog", { name: "Buscar", exact: true });
  const open = async () => {
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await dialog.waitFor();
  };
  await open();
  const input = dialog.getByRole("textbox", {
    name: "Busca global",
    exact: true,
  });
  await input.fill("ana");
  const result = dialog.getByRole("button", {
    name: new RegExp(customer.name),
  });
  await result.waitFor();
  await dialog.getByRole("button", { name: new RegExp(order.title) }).waitFor();
  assert.equal(
    await input.evaluate((node) => getComputedStyle(node).fontSize),
    "16px",
  );
  await page.screenshot({
    path: `/workspace/attachments/busca-mobile-${process.env.AUDIT_THEME || "dark"}-${process.env.MOBILE_WIDTH || 390}.png`,
    animations: "disabled",
  });
  const fieldColors = await input.evaluate((node) => ({
    text: getComputedStyle(node).color,
    background: getComputedStyle(node.parentElement).backgroundColor,
  }));
  const luminance = (color) => {
    const values = color
      .match(/[0-9.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  };
  assert(
    !fieldColors.background.includes("rgba"),
    "Search field must have a solid background",
  );
  const foreground = luminance(fieldColors.text),
    background = luminance(fieldColors.background);
  assert(
    (Math.max(foreground, background) + 0.05) /
      (Math.min(foreground, background) + 0.05) >=
      4.5,
    JSON.stringify(fieldColors),
  );
  const clearBox = await dialog
    .getByRole("button", { name: "Limpar busca", exact: true })
    .boundingBox();
  assert(
    clearBox.x >= 0 && clearBox.x + clearBox.width <= page.viewportSize().width,
    "Clear action must stay within the viewport",
  );
  mode = "gated";
  const began = new Promise((resolve) => {
    searchStarted = resolve;
  });
  await input.fill("beatriz");
  assert.equal(
    await result.count(),
    0,
    "Previous query results must not remain clickable during debounce",
  );
  await dialog.getByText("Buscando...", { exact: true }).waitFor();
  await began;
  assert.equal(
    await dialog
      .getByText("Nenhum resultado para essa busca.", { exact: true })
      .count(),
    0,
  );
  releaseSearch();
  mode = "grouped";
  await result.waitFor();
  await dialog
    .getByRole("button", { name: "Limpar busca", exact: true })
    .click();
  await input.focus();
  await dialog
    .getByText("Digite pelo menos 2 caracteres.", { exact: true })
    .waitFor();
  assert.equal(
    await result.count(),
    0,
    "Focusing a cleared search must not restore old hits",
  );
  mode = "error";
  await input.fill("falha");
  await dialog
    .getByText("Não foi possível carregar a busca.", { exact: true })
    .waitFor();
  assert.equal(
    await dialog
      .getByText("Nenhum resultado para essa busca.", { exact: true })
      .count(),
    0,
  );
  mode = "grouped";
  await dialog
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await result.waitFor();
  assert.equal(await input.inputValue(), "falha");
  mode = "malformed";
  await input.fill("contrato");
  await dialog
    .getByText("Não foi possível carregar a busca.", { exact: true })
    .waitFor();
  mode = "empty";
  await input.fill("vazio");
  await dialog
    .getByText("Nenhum resultado para essa busca.", { exact: true })
    .waitFor();
  mode = "grouped";
  await input.fill("cliente");
  await result.click();
  await page.waitForURL("**/customers?customerId=customer-1");
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Notificações", exact: true }).click();
  await page
    .getByRole("menuitem")
    .filter({ hasText: "Abrir cliente da notificação" })
    .click();
  await page.getByRole("menu").waitFor({ state: "hidden" });
  role = "STAFF";
  mode = "legacy";
  await page.goto("http://localhost:5173/customers");
  await open();
  await input.fill("restrito");
  await result.waitFor();
  assert.equal(
    await dialog.getByRole("button", { name: /Cobrança restrita/ }).count(),
    0,
  );
  await result.click();
  await page.waitForURL("**/customers?customerId=customer-1");
  assert.equal(
    new URL(page.url()).origin,
    "http://localhost:5173",
    "Raw external routes must never be used",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, ["dashboard.notificationCenter.markAsRead"]);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await browser.close();
  console.log(
    "PASS: grouped/legacy contract, stale query gating, clear, retry/error versus empty, role-safe routes, and closing notification navigation.",
  );
})().catch(async (error) => {
  console.error(error);
  if (page) {
    console.error(
      await page.getByRole("dialog").evaluateAll((nodes) =>
        nodes.map((n) => ({
          box: n.getBoundingClientRect().toJSON(),
          html: n.innerText,
        })),
      ),
    );
    await page.screenshot({ path: "/workspace/attachments/search-debug.png" });
  }
  process.exit(1);
});
