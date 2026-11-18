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
  let hasCustomer = false,
    hasAppointment = false,
    hasOrder = false,
    hasCharge = false,
    execution;
  let role = "ADMIN",
    homeMissing = false,
    homeEmpty = false;
  const reads = [];
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
    else reads.push(...names);
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
          data = [person];
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

  page.setDefaultTimeout(10000);
  for (const accountRole of ["ADMIN", "MANAGER", "STAFF", "VIEWER"]) {
    role = accountRole;
    reads.length = 0;
    console.log("ROLE", accountRole);
    await page.goto("http://localhost:5173/customers");
    const consent = page.getByRole("button", {
      name: "Somente essenciais",
      exact: true,
    });
    if (await consent.isVisible()) await consent.click();
    if (role === "VIEWER") {
      await page
        .getByRole("heading", { name: "Clientes", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Novo cliente", exact: true })
          .count(),
        0,
      );
      assert.equal(
        reads.filter((name) => name.startsWith("finance.")).length,
        0,
      );
      continue;
    }
    await page
      .getByRole("button", { name: "Novo cliente", exact: true })
      .click();
    const customerForm = page.getByRole("dialog", {
      name: "Novo Cliente",
      exact: true,
    });
    await customerForm.waitFor();
    const billing = customerForm.getByRole("button", {
      name: /^Criar cobrança/,
    });
    assert.equal(
      await billing.count(),
      role === "STAFF" ? 0 : 1,
      role + " billing visibility",
    );
    await customerForm
      .locator("#customer-name")
      .fill("Cliente do perfil " + role);
    await customerForm.locator("#customer-phone").fill("11999990000");
    await customerForm
      .getByRole("button", { name: "Criar cliente e continuar", exact: true })
      .click();
    await customerForm
      .getByText("Cliente criado com sucesso", { exact: true })
      .waitFor();
    await customerForm
      .getByRole("button", { name: "Criar O.S.", exact: true })
      .click();
    const orderForm = page.getByRole("dialog", {
      name: "Nova O.S.",
      exact: true,
    });
    await orderForm.waitFor();
    await orderForm
      .getByLabel("Serviço que será feito *", { exact: true })
      .fill("Serviço criado pelo perfil " + role);
    await orderForm
      .getByRole("button", { name: "Criar O.S.", exact: true })
      .click();
    await orderForm
      .getByText("Ordem de serviço criada com sucesso", { exact: true })
      .waitFor();
    await orderForm
      .getByRole("button", { name: "Fechar", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Notificações", exact: true })
      .click();
    const notice = page
      .getByRole("heading", { name: "O.S. criada com sucesso", exact: true })
      .locator("..");
    await notice.waitFor();
    assert.equal(
      await notice
        .getByRole("button", { name: "Ir para Financeiro", exact: true })
        .count(),
      role === "STAFF" ? 0 : 1,
    );
    if (role === "STAFF") {
      await notice
        .getByRole("button", { name: "Ver O.S.", exact: true })
        .click();
      await page.waitForURL("**/service-orders?**");
      assert.equal(
        reads.filter((name) => name.startsWith("finance.")).length,
        0,
        "Staff workflow must not request financial data",
      );
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: Admin/Manager billing, staff operational continuation without finance reads, and viewer without create actions.",
  );
})().catch(async (error) => {
  console.error(error);
  if (page) console.error(page.url(), await page.locator("body").innerText());
  process.exit(1);
});
