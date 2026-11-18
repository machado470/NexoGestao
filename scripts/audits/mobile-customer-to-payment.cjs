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
  await page.goto("http://localhost:5173/customers");
  await page
    .getByRole("button", { name: "Somente essenciais", exact: true })
    .click();
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  const customerForm = page.getByRole("dialog", {
    name: "Novo Cliente",
    exact: true,
  });
  await customerForm
    .locator("#customer-name")
    .fill("Cliente da Jornada Mobile");
  await customerForm.locator("#customer-phone").fill("11999990000");
  await customerForm
    .getByRole("button", { name: "Criar cliente e continuar", exact: true })
    .click();
  await customerForm
    .getByText("Cliente criado com sucesso", { exact: true })
    .waitFor();
  await customerForm
    .getByRole("button", { name: "Criar agendamento", exact: true })
    .click();
  await page.waitForURL("**/appointments?**");
  const schedule = page.getByRole("dialog", {
    name: "Novo agendamento",
    exact: true,
  });
  await schedule.waitFor();
  assert.equal(writes.filter((x) => x === "customers.create").length, 1);
  assert.equal(
    await schedule.getByRole("combobox").first().innerText(),
    customer.name,
  );
  await schedule.getByLabel("Data", { exact: true }).fill("2026-11-20");
  await schedule.getByLabel("Hora", { exact: true }).fill("09:00");
  await schedule.getByLabel("Responsável", { exact: true }).click();
  await page.getByRole("option", { name: person.name, exact: true }).click();
  await schedule.getByRole("button", { name: "Salvar", exact: true }).click();
  await schedule.waitFor({ state: "hidden" });
  assert.equal(appt.customerId, customer.id);
  assert.equal(appt.assignedToPersonId, person.id);
  assert.equal(appt.startsAt, "2026-11-20T12:00:00.000Z");
  await page
    .getByRole("button", { name: `Ações de ${customer.name}`, exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Criar O.S.", exact: true }).click();
  const service = page.getByRole("dialog", { name: "Nova O.S.", exact: true });
  await service.waitFor();
  await service
    .getByLabel("Serviço que será feito *", { exact: true })
    .fill("Manutenção da visita agendada");
  await service
    .getByLabel("Responsável pela execução", { exact: true })
    .click();
  await page.getByRole("option", { name: person.name, exact: true }).click();
  await service.getByRole("button", { name: /^Financeiro/ }).click();
  await service.getByLabel("Valor (R$)", { exact: true }).fill("150,00");
  await service
    .getByRole("button", { name: "Criar O.S.", exact: true })
    .click();
  await service.getByRole("button", { name: "Ver O.S.", exact: true }).click();
  await page.waitForURL("**/service-orders?**");
  assert.equal(order.customerId, customer.id);
  assert.equal(order.appointmentId, appt.id);
  assert.equal(order.assignedToPersonId, person.id);
  assert.equal(order.amountCents, 15000);
  await page
    .getByRole("button", { name: "Iniciar execução", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Concluir execução", exact: true })
    .click();
  await page.getByText("O.S. concluída.", { exact: true }).first().waitFor();
  assert.equal(execution.status, "COMPLETED");
  await page
    .getByRole("button", { name: "Gerar cobrança", exact: true })
    .click();
  await page
    .getByText("Cobrança gerada com sucesso.", { exact: true })
    .waitFor();
  await page
    .getByRole("navigation", { name: "Navegação principal no celular" })
    .getByRole("button", { name: "Financeiro", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Registrar pagamento", exact: true })
    .first()
    .click();
  const payment = page.getByRole("dialog", {
    name: "Registrar pagamento manual",
    exact: true,
  });
  await payment.waitFor();
  await payment
    .getByLabel("Valor exato em centavos", { exact: true })
    .fill("15000");
  await payment
    .getByRole("button", { name: "Confirmar pagamento", exact: true })
    .click();
  await payment.waitFor({ state: "hidden" });
  await page
    .getByText("Pagamento confirmado pelo serviço financeiro.", { exact: true })
    .waitFor();
  assert.equal(charge.status, "PAID");
  assert.equal(charge.balanceCents, 0);
  assert.equal(charge.paidAmountCents, 15000);
  assert.equal(
    writes.filter((name) => name === "finance.charges.pay").length,
    1,
  );
  assert.deepEqual(errors, []);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: `/workspace/attachments/fluxo-recebimento-${process.env.MOBILE_WIDTH || 390}.png`,
    animations: "disabled",
  });
  await page
    .getByRole("navigation", { name: "Navegação principal no celular" })
    .getByRole("button", { name: "Clientes", exact: true })
    .click();
  const search = page.getByPlaceholder("Buscar por nome, telefone ou e-mail", {
    exact: true,
  });
  await search.fill("Nome que não existe");
  await page
    .getByText("Nenhum resultado para os filtros", { exact: true })
    .waitFor();
  await search.fill(customer.name);
  await page
    .getByRole("button", { name: "Mais ações", exact: true })
    .first()
    .click();
  await page
    .getByRole("menuitem", { name: "Editar dados", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: `Cliente #${customer.id}`,
    exact: true,
  });
  await editor
    .getByLabel("Nome *", { exact: true })
    .fill("Cliente atualizado no celular");
  await editor.getByRole("button", { name: "Salvar", exact: true }).click();
  await editor.waitFor({ state: "hidden" });
  assert.equal(customer.name, "Cliente atualizado no celular");
  // Open the selected customer's detail and return to the list without losing search.
  await search.fill(customer.name);
  await page
    .getByRole("button", { name: customer.name, exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Voltar aos clientes", exact: true })
    .click();
  assert.equal(await search.inputValue(), customer.name);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.getByRole("button", { name: "Notificações", exact: true }).click();
  await page.getByText("Avisos desta sessão", { exact: true }).waitFor();
  await page
    .getByRole("button", {
      name: "Dispensar aviso: Cliente criado",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Ir para Financeiro", exact: true })
    .click();
  await page.waitForURL("**/finances?**");
  assert.equal(
    await page.getByText("Avisos desta sessão", { exact: true }).count(),
    0,
    "Choosing a notice closes the panel",
  );
  // Navigation to the existing route resets details before testing another creation choice.
  await page.goto("http://localhost:5173/customers");
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  const billingCustomer = page.getByRole("dialog", {
    name: "Novo Cliente",
    exact: true,
  });
  await billingCustomer
    .locator("#customer-name")
    .fill("Cliente com próximo passo cobrança");
  await billingCustomer.locator("#customer-phone").fill("11988880000");
  await billingCustomer
    .getByRole("button", { name: /^Criar cobrança/ })
    .click();
  await billingCustomer
    .getByRole("button", { name: "Criar cliente e continuar", exact: true })
    .click();
  await billingCustomer
    .getByText("Cliente criado com sucesso", { exact: true })
    .waitFor();
  await billingCustomer
    .getByRole("button", { name: "Criar cobrança", exact: true })
    .click();
  const billingForm = page.getByRole("dialog", {
    name: "Nova cobrança",
    exact: true,
  });
  await billingForm.waitFor();
  await billingForm.getByRole("combobox").first().getByText(customer.name, {exact:true}).waitFor();
  assert.equal(
    writes.filter((name) => name === "finance.charges.create").length,
    0,
    "Opening the next form must not create a charge",
  );
  assert.deepEqual(errors, []);
  await billingForm
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  await billingForm.waitFor({ state: "hidden" });
  await page
    .getByRole("navigation", { name: "Navegação principal no celular" })
    .getByRole("button", { name: "Clientes", exact: true })
    .click();
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  const registration = page.getByRole("dialog", {
    name: "Novo Cliente",
    exact: true,
  });
  await registration.locator("#customer-name").fill("Cliente somente cadastro");
  await registration.locator("#customer-phone").fill("11977770000");
  await registration.getByRole("button", { name: /^Apenas cadastrar/ }).click();
  await registration
    .getByRole("button", { name: "Criar cliente e continuar", exact: true })
    .click();
  await registration
    .getByText("Cliente criado com sucesso", { exact: true })
    .waitFor();
  assert.equal(
    await registration
      .getByRole("button", { name: "Criar agendamento", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await registration
      .getByRole("button", { name: "Criar cobrança", exact: true })
      .count(),
    0,
  );
  assert.equal(
    writes.filter((name) => name === "appointments.create").length,
    1,
    "Registration-only must not create another appointment",
  );
  assert.deepEqual(errors, []);
  for (const [name,count] of Object.entries({"customers.create":3,"customers.update":1,"appointments.create":1,"serviceOrders.create":1,"executions.start":1,"executions.complete":1,"serviceOrders.generateCharge":1,"finance.charges.pay":1})) {
    assert.equal(writes.filter(item=>item===name).length,count,`Unexpected number of ${name} calls`);
  }
  console.log(
    "PASS: customer-to-payment, search/edit/detail, preserved billing choice and optional registration with local fixtures.",
  );
  await browser.close();
})().catch(async (error) => {
  console.error(error);
  if (page) console.error(await page.locator("body").innerText());
  process.exit(1);
});
