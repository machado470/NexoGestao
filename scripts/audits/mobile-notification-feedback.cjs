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
      req.method() === "POST" ? req.postData() || "{}" : new URL(req.url()).searchParams.get("input") || "{}",
    );
    if (names.includes("globalSearch.search") && mode === "gated")
      await new Promise((resolve) => {
        releaseSearch = resolve;
        searchStarted?.();
      });
    const out = await Promise.all(names.map(async (n, index) => {
      const input = inputs[index]?.json ?? inputs[index] ?? {};
      if (n === "dashboard.notificationCenter.markAsRead") {
        marks.push(input.id);
        await new Promise(resolve => gates.set(input.id, resolve));
        if ((input.id === "notice-A" && marks.filter(id => id === input.id).length === 1) || input.id === "notice-C") {
          return { error: { json: { message: "Leitura rejeitada na simulação", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 503, path: n } } } };
        }
        notices.find(notice => notice.id === input.id).read = true;
        if (input.id === "notice-A") holdRefresh = true;
        return { result: { data: { json: { ok: true } } } };
      }
      if (n === "dashboard.notificationCenter.list" || n === "dashboard.notificationCenter.unreadCount") {
        if (holdRefresh) await refreshGate;
        const count = notices.filter(notice => !notice.read).length;
        return { result: { data: { json: n.endsWith(".list") ? { items: notices, unreadCount: count } : { count } } } };
      }
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
    }));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(out),
    });
  });

  page.setDefaultTimeout(12000);
  const notices = [
    { id: "notice-A", title: "Cobrança precisa de atenção no atendimento de um cliente com nome comprido", message: "Confira o histórico antes de entrar em contato. Mensagem completa com orientação que não deve ser cortada depois da segunda linha.", read: false, routeHint: null },
    { id: "notice-B", title: "Atualização independente do segundo cliente", message: "Outro aviso que pode ser marcado enquanto o primeiro está pendente.", read: false, routeHint: null },
    { id: "notice-C", title: "Abrir cliente com rota válida", message: "Navegação deve funcionar mesmo se a leitura falhar.", read: false, routeHint: "/customers?customerId=customer-1" },
  ];
  const marks = [], gates = new Map();
  let releaseRefresh, holdRefresh = false;
  const refreshGate = new Promise(resolve => releaseRefresh = resolve);
  await page.goto("http://localhost:5173/customers");
  await page.getByText("Horários em America/Sao_Paulo", { exact: true }).waitFor();
  const consent = page.getByRole("button", { name: "Somente essenciais", exact: true });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole("button", { name: "Notificações", exact: true }).click();
  const menu = page.getByRole("menu");
  const item = id => menu.getByRole("menuitem").filter({ hasText: notices.find(n => n.id === id).title });
  await item("notice-A").waitFor();
  const contrast = await item("notice-A").locator("p").first().evaluate(node => {
    const menu = node.closest('[role="menu"]');
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = color => rgb(color).map(value => {
      const n = value / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
    const a = luminance(getComputedStyle(node).color), b = luminance(getComputedStyle(menu).backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  assert(contrast >= 4.5, `Notification title contrast ${contrast}`);

  const box = await menu.boundingBox();
  assert(box.x >= 0 && box.x + box.width <= Number(process.env.MOBILE_WIDTH || 390));
  const message = item("notice-A").getByText(notices[0].message, { exact: true });
  assert.equal(await message.evaluate(node => getComputedStyle(node).webkitLineClamp), "none");
  await item("notice-A").evaluate(node => { node.click(); node.click(); });
  for (let i = 0; !gates.has("notice-A") && i < 1200; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert(gates.has("notice-A")); assert.deepEqual(marks, ["notice-A"]);
  await menu.getByText("Marcando como lida…", { exact: true }).waitFor();
  await item("notice-B").click();
  for (let i = 0; !gates.has("notice-B") && i < 1200; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert(gates.has("notice-B")); gates.get("notice-B")();
  gates.get("notice-A")(); gates.delete("notice-A");
  const retry = menu.getByRole("menuitem", { name: `Tentar marcar como lida: ${notices[0].title}`, exact: true });
  await retry.waitFor();
  assert.equal(await menu.getByRole("menuitem", { name: `Tentar marcar como lida: ${notices[1].title}`, exact: true }).count(), 0);
  assert((await retry.boundingBox()).height >= 44);
  await page.screenshot({ path: `/workspace/attachments/notifications-retry-${process.env.MOBILE_WIDTH || 390}.png`, animations: "disabled" });
  await item("notice-A").focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(node => document.activeElement === node, await retry.elementHandle());
  await page.keyboard.press("Enter");
  for (let i = 0; !gates.has("notice-A") && i < 1200; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert(gates.has("notice-A")); gates.get("notice-A")();
  await retry.waitFor({ state: "hidden" });
  await menu.getByText("Marcando como lida…", { exact: true }).waitFor({ state: "hidden" });
  assert.equal(holdRefresh, true, "Confirmed mutation must finish before refresh");
  releaseRefresh();
  await item("notice-C").click();
  await page.waitForURL("**/customers?customerId=customer-1");
  await menu.waitFor({ state: "hidden" });
  for (let i = 0; !gates.has("notice-C") && i < 1200; i++) await new Promise(resolve => setTimeout(resolve, 10));
  gates.get("notice-C")();
  await page.getByRole("button", { name: "Notificações", exact: true }).click();
  await menu.getByRole("menuitem", { name: `Tentar marcar como lida: ${notices[2].title}`, exact: true }).waitFor();
  assert.deepEqual(marks, ["notice-A", "notice-B", "notice-A", "notice-C"]);
  assert.deepEqual(errors, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log("PASS", process.env.MOBILE_WIDTH || 390, "notification layout/full message, per-id lock and error, explicit retry, confirmation before refresh and safe navigation despite read failure");
  await browser.close();
})().catch(async error => { console.error(error); if (page) console.log((await page.locator("body").innerText()).slice(-2000)); process.exit(1); });
