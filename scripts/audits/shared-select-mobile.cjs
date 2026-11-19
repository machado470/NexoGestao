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
  let hasCustomer = true,
    hasAppointment = true,
    hasOrder = true,
    hasCharge = true,
    execution;
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
    const inputs = JSON.parse(
      req.method() === "POST"
        ? req.postData() || "{}"
        : new URL(req.url()).searchParams.get("input") || "{}",
    );
    const out = names.map((n, index) => {
      const input = inputs[index]?.json ?? inputs[index] ?? {};
      let changed;
      switch (n) {
        case "customers.update":
          Object.assign(customer, input);
          changed = customer;
          break;
        case "customers.create":
          hasCustomer = true;
          Object.assign(customer, input);
          changed = customer;
          break;
        case "appointments.create":
          hasAppointment = true;
          Object.assign(appt, input, { customer });
          changed = appt;
          break;
        case "serviceOrders.create":
          hasOrder = true;
          Object.assign(order, input, {
            customer,
            status: "ASSIGNED",
            operationalDecision: {
              ...order.operationalDecision,
              nextAction: { type: "start", label: "Iniciar serviço" },
            },
          });
          changed = order;
          break;
        case "executions.start":
          execution = {
            id: "execution-1",
            serviceOrderId: order.id,
            status: "IN_PROGRESS",
          };
          Object.assign(order, {
            status: "IN_PROGRESS",
            operationalDecision: {
              ...order.operationalDecision,
              nextAction: { type: "complete", label: "Concluir serviço" },
            },
          });
          changed = execution;
          break;
        case "executions.complete":
          Object.assign(execution, { status: "COMPLETED" });
          Object.assign(order, {
            status: "COMPLETED",
            operationalDecision: {
              ...order.operationalDecision,
              nextAction: { type: "charge", label: "Gerar cobrança" },
            },
          });
          changed = execution;
          break;
        case "serviceOrders.generateCharge":
          hasCharge = true;
          changed = charge;
          break;
        case "finance.charges.pay":
          Object.assign(charge, {
            status: "PAID",
            paidAmountCents: input.amountCents,
            balanceCents: 0,
          });
          changed = { ok: true, paymentId: "payment-1", idempotent: false };
          break;
      }
      if (changed) return { result: { data: { json: changed } } };
      let data = [];
      switch (n) {
        case "executions.listByServiceOrder":
          data = execution ? [execution] : [];
          break;
        case "serviceOrders.getById":
          data = order;
          break;
        case "finance.charges.getById":
          data = charge;
          break;
        case "customers.getById":
          data = customer;
          break;
        case "customers.workspace":
          data = { customer };
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
            items: hasCustomer ? [customer] : [],
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
          data = hasCustomer ? [customer] : [];
          break;
        case "people.assignees":
          data = Array.from({ length: 12 }, (_, i) => ({ ...person, id: `person-${i + 1}`, personId: `person-${i + 1}`, name: `Pessoa ${i + 1} com nome extenso para testar escolha no celular e leitura completa SemEspacosABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ` }));
          break;
        case "people.operationalSummary":
          data = { people: [person] };
          break;
        case "appointments.page":
          data = {
            items: hasAppointment ? [appt] : [],
            meta: { page: 1, limit: 8, total: 1, pages: 1 },
          };
          break;
        case "appointments.list":
          data = hasAppointment ? [appt] : [];
          break;
        case "serviceOrders.page":
          data = {
            items: hasOrder ? [order] : [],
            meta: { page: 1, limit: 8, total: 1, pages: 1 },
          };
          break;
        case "serviceOrders.list":
          data = hasOrder ? [order] : [];
          break;
        case "finance.charges.list":
          data = {
            items: hasCharge ? [charge] : [],
            pagination: { total: hasCharge ? 1 : 0 },
          };
          break;
        case "finance.charges.stats":
          data = {
            currencies: ["BRL"],
            pending: {
              amountCents: hasCharge ? charge.balanceCents : 0,
              count: hasCharge && charge.status === "PENDING" ? 1 : 0,
            },
            paid: {
              amountCents: hasCharge ? charge.paidAmountCents : 0,
              count: hasCharge && charge.status === "PAID" ? 1 : 0,
            },
            overdue: { amountCents: 0, count: 0 },
          };
          break;
        case "finance.operationalQueue":
          data = hasCharge ? [charge] : [];
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
    const notice = page.getByRole("button", { name: "Fechar aviso", exact: true });
    if (await notice.count()) { const node = await notice.first().elementHandle(); await notice.first().click(); await page.waitForFunction(node => !node.isConnected, node); }
  };
  const check = async trigger => {
    if (width < 768) {
      assert((await trigger.boundingBox()).height >= 44);
      assert.equal(await trigger.evaluate(node => getComputedStyle(node).fontSize), "16px");
    }
    const list = page.getByRole("listbox"); await list.waitFor(); await list.screenshot({ animations: "disabled" });
    const box = await list.boundingBox(); assert(box.x >= 0 && box.x + box.width <= width + 1);
    for (const option of await list.getByRole("option").all()) {
      if (width < 768) { assert((await option.boundingBox()).height >= 44); assert.equal(await option.evaluate(node => getComputedStyle(node).fontSize), "16px"); }
      await option.focus();
      const ratio = await option.evaluate(node => {
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1; const ctx = canvas.getContext("2d");
        ctx.fillStyle = getComputedStyle(node.closest('[role="listbox"]')).backgroundColor; ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = getComputedStyle(node).backgroundColor; ctx.fillRect(0, 0, 1, 1); const bg = [...ctx.getImageData(0, 0, 1, 1).data];
        ctx.fillStyle = getComputedStyle(node).color; ctx.fillRect(0, 0, 1, 1); const fg = [...ctx.getImageData(0, 0, 1, 1).data];
        const lum = rgb => rgb.slice(0, 3).map(v => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        return (Math.max(lum(bg), lum(fg)) + .05) / (Math.min(lum(bg), lum(fg)) + .05);
      });
      assert(ratio >= 4.5, `Focused option contrast ${ratio}`);
    }
  };
  await visit("finances");
  const status = page.getByRole("combobox", { name: "Filtrar por status oficial", exact: true, includeHidden: true });
  await status.click(); await check(status);
  await page.getByRole("option", { name: "Pagas", exact: true }).click();
  await page.getByRole("listbox").waitFor({ state: "hidden" });
  await page.getByText("Nenhuma cobrança encontrada", { exact: true }).waitFor();
  await status.click(); await page.getByRole("option", { name: "Todos", exact: true }).click();
  await page.getByRole("button", { name: "Registrar pagamento", exact: true }).first().waitFor();
  await visit("service-orders");
  if (width < 768) await page.locator("summary").filter({ hasText: /^Mais filtros$/ }).click();
  const responsible = page.getByRole("combobox", { name: "Filtrar por responsável", exact: true, includeHidden: true });
  await responsible.click(); await check(responsible);
  const last = page.getByRole("option", { name: /^Pessoa 12 com nome extenso/ });
  assert(await last.evaluate(node => {
    const text = node.lastElementChild;
    return text.getBoundingClientRect().right <= node.getBoundingClientRect().right && text.scrollWidth <= text.clientWidth + 1;
  }), "Long option text must wrap inside its row");
  await last.scrollIntoViewIfNeeded();
  const box = await last.boundingBox(); assert(box.x >= 0 && box.x + box.width <= width + 1);
  await page.screenshot({ path: `/workspace/attachments/shared-select-${width}-${process.env.AUDIT_THEME || "dark"}.png`, animations: "disabled" });
  await page.keyboard.press("End"); await page.keyboard.press("Enter");
  await page.getByRole("listbox").waitFor({ state: "hidden" });
  assert.match(await responsible.innerText(), /Pessoa 12/);
  await page.getByText("Nenhum resultado para os filtros", { exact: true }).waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await responsible.click(); await page.getByRole("option", { name: "Todos os responsáveis", exact: true }).click();
  assert.equal(await page.getByText("Nenhum resultado para os filtros", { exact: true }).count(), 0);
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  console.log("PASS", width, process.env.AUDIT_THEME || "dark", "shared select sizing, option contrast, long labels, last option by keyboard, finance/order filters and reset");
  await browser.close();
})().catch(async error => { console.error(error); if (page) console.log((await page.locator("body").innerText()).slice(-1800)); process.exit(1); });
