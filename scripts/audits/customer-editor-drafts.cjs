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

  page.setDefaultTimeout(15000);
  const native = [];
  page.on("dialog", async dialog => { native.push(dialog.type()); await dialog.dismiss(); });
  let failReads = true, readCount = 0, saveCount = 0, releaseSave, holdLists = false, releaseLists;
  let listGate = new Promise(resolve => releaseLists = resolve);
  customer.updatedAt = "2026-11-17T12:00:00Z";
  await page.route("**/api/trpc/**", async route => {
    const req = route.request(), url = new URL(req.url());
    const names = url.pathname.split("/api/trpc/")[1].split(",");
    if (!names.some(n => n === "customers.getById" || n === "customers.update" || n === "customers.create" || (holdLists && n.startsWith("customers.")))) return route.fallback();
    const inputs = JSON.parse(req.method() === "POST" ? req.postData() || "{}" : url.searchParams.get("input") || "{}");
    const out = [];
    for (let i = 0; i < names.length; i++) {
      const n = names[i], input = inputs[i]?.json ?? inputs[i] ?? {};
      const failure = message => ({ error: { json: { message, code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 503, path: n } } } });
      if (n === "customers.getById") {
        readCount++;
        if (failReads) { out.push(failure("Leitura temporariamente indisponível")); continue; }
        out.push({ result: { data: { json: customer } } }); continue;
      }
      if (n === "customers.create") {
        writes.push(n); Object.assign(customer, input, { id: "customer-created" }); holdLists = true;
        out.push({ result: { data: { json: customer } } }); continue;
      }
      if (n === "customers.update") {
        saveCount++; writes.push(n);
        assert.equal(input.expectedUpdatedAt, "2026-11-17T12:00:00Z");
        await new Promise(resolve => releaseSave = resolve);
        if (saveCount === 1) { out.push(failure("Gravação rejeitada na simulação")); continue; }
        Object.assign(customer, input, { updatedAt: "2026-11-18T12:00:00Z" });
        holdLists = true;
        out.push({ result: { data: { json: customer } } }); continue;
      }
      if (holdLists && n.startsWith("customers.")) await listGate;
      out.push({ result: { data: { json: n === "customers.list" ? [customer] : [] } } });
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(out) });
  });
  const prompt = page.getByRole("alertdialog", { name: "Descartar alterações?", exact: true });
  const editor = page.getByRole("dialog", { name: "Cliente #customer-1", exact: true });
  const keep = async () => {
    await prompt.waitFor();
    await prompt.getByRole("button", { name: "Continuar editando", exact: true }).click();
    await prompt.waitFor({ state: "hidden" });
  };
  const discard = async () => {
    await prompt.waitFor();
    await prompt.getByRole("button", { name: "Descartar alterações", exact: true }).click();
    await prompt.waitFor({ state: "hidden" });
  };
  const unloadBlocked = () => page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented;
  });
  await page.goto("http://localhost:5173/profile");
  const consent = page.getByRole("button", { name: "Somente essenciais", exact: true });
  if (await consent.isVisible()) await consent.click();
  const nav = page.getByRole("navigation", { name: "Navegação principal no celular" });
  await nav.getByRole("button", { name: "Clientes", exact: true }).click();
  const creation = page.getByRole("dialog", { name: "Novo Cliente", exact: true });
  await page.getByRole("button", { name: "Novo cliente", exact: true }).first().click();
  await creation.waitFor(); await creation.locator("#customer-name").fill("Cadastro ainda não salvo");
  await page.evaluate(() => history.back()); await keep();
  assert.equal(await creation.locator("#customer-name").inputValue(), "Cadastro ainda não salvo");
  await page.evaluate(() => history.back()); await discard(); await page.waitForURL("**/profile");
  assert.deepEqual(writes, []);
  await nav.getByRole("button", { name: "Clientes", exact: true }).click();
  const open = async () => {
    await page.getByRole("button", { name: "Mais ações", exact: true }).first().click();
    await page.getByRole("menuitem", { name: "Editar dados", exact: true }).click();
    await page.getByRole("menu").waitFor({ state: "hidden" }); await editor.waitFor();
  };
  await open();
  await editor.getByText("Não foi possível carregar os dados do cliente.", { exact: true }).waitFor();
  assert.equal(readCount, 2, "Temporary read gets one retry"); failReads = false;
  await editor.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  const nameInput = editor.getByLabel("Nome *", { exact: true });
  await nameInput.waitFor();
  await page.waitForFunction(() => document.querySelector('#edit-customer-name')?.value.length > 0);
  const original = await nameInput.inputValue();
  await nameInput.fill("Rascunho preservado no celular");
  await editor.getByRole("button", { name: "Cancelar", exact: true }).click(); await keep();
  assert.equal(await nameInput.inputValue(), "Rascunho preservado no celular");
  await page.keyboard.press("Escape"); await prompt.waitFor(); await page.keyboard.press("Escape"); await prompt.waitFor({ state: "hidden" });
  await editor.getByRole("button", { name: "Recarregar dados", exact: true }).click(); await keep();
  assert.equal(await nameInput.inputValue(), "Rascunho preservado no celular");
  failReads = true;
  await editor.getByRole("button", { name: "Recarregar dados", exact: true }).click(); await discard();
  await editor.getByText("Não foi possível atualizar os dados. Suas alterações foram preservadas.", { exact: true }).waitFor();
  assert.equal(await nameInput.inputValue(), "Rascunho preservado no celular");
  failReads = false;
  await editor.getByRole("button", { name: "Recarregar dados", exact: true }).click(); await discard();
  await page.waitForFunction(value => document.querySelector('#edit-customer-name')?.value === value, original);
  await nameInput.fill("Rascunho para descartar");
  await page.evaluate(() => history.back()); await discard(); await page.waitForURL("**/profile");
  await nav.getByRole("button", { name: "Clientes", exact: true }).click();
  await open(); await nameInput.waitFor();
  await page.waitForFunction(value => document.querySelector('#edit-customer-name')?.value === value, original);
  await nameInput.fill("Cliente salvo no celular");
  await page.evaluate(() => history.back()); await keep();
  assert.equal(new URL(page.url()).pathname, "/customers");
  assert.equal(await nameInput.inputValue(), "Cliente salvo no celular");
  assert.equal(await unloadBlocked(), true);
  await page.screenshot({ path: `/workspace/attachments/customer-editor-${process.env.MOBILE_WIDTH || 390}.png`, animations: "disabled" });
  const save = editor.getByRole("button", { name: "Salvar", exact: true });
  await save.evaluate(node => { node.click(); node.click(); });
  for (let i = 0; !releaseSave && i < 1500; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert(releaseSave); assert.equal(saveCount, 1); assert.equal(await nameInput.isDisabled(), true);
  assert.equal(await editor.getByRole("button", { name: "Cancelar", exact: true }).isDisabled(), true);
  await page.keyboard.press("Escape"); assert.equal(await editor.isVisible(), true);
  releaseSave(); releaseSave = undefined;
  await page.getByText("Gravação rejeitada na simulação", { exact: true }).waitFor();
  assert.equal(await nameInput.inputValue(), "Cliente salvo no celular");
  await save.click();
  for (let i = 0; !releaseSave && i < 1500; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert(releaseSave); releaseSave();
  await editor.waitFor({ state: "hidden" });
  assert.equal(holdLists, true); assert.equal(customer.name, "Cliente salvo no celular");
  assert.equal(await prompt.count(), 0); releaseLists();
  holdLists = false;
  await page.goto("http://localhost:5173/customers");
  listGate = new Promise(resolve => releaseLists = resolve);
  await page.getByRole("button", { name: "Novo cliente", exact: true }).first().click();
  await creation.waitFor();
  await creation.locator("#customer-name").fill("Cadastro confirmado com consultas lentas");
  await creation.locator("#customer-phone").fill("11999990000");
  await creation.getByRole("button", { name: "Criar cliente e continuar", exact: true }).click();
  await creation.getByRole("button", { name: "Criar agendamento", exact: true }).click();
  await page.waitForURL("**/appointments?**");
  assert.equal(new URL(page.url()).searchParams.get("customerId"), "customer-created");
  assert.equal(await prompt.count(), 0);
  assert.equal(holdLists, true, "Continuation must work before post-confirmation reads settle");
  releaseLists();
  assert.equal(writes.filter(n => n === "customers.create").length, 1);
  assert.deepEqual(native, []); assert.deepEqual(errors, []); assert.equal(saveCount, 2);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log("PASS", process.env.MOBILE_WIDTH || 390, "customer editor read recovery, custom close/reload, failed reload draft, Back, frozen pending fields, double click, rejection, confirmation and creation continuation before held reads");
  await browser.close();
})().catch(async error => { console.error(error); if (page) console.log((await page.locator("body").innerText()).slice(-3000)); process.exit(1); });
