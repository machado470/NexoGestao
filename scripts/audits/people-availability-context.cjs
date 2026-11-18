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
  const periods = { "person-1": [], "person-2": [] };
  const requests = [];
  let releaseWrite,
    started,
    holdReads = false,
    releaseReads,
    readGate;
  let deletes = 0;
  function gateReads() {
    holdReads = true;
    readGate = new Promise(
      (resolve) =>
        (releaseReads = () => {
          holdReads = false;
          resolve();
        }),
    );
  }

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
    if (
      req.method() === "POST" &&
      names.some((n) => n.includes("AvailabilityException"))
    )
      await new Promise((resolve) => {
        releaseWrite = resolve;
        started?.();
      });
    if (
      holdReads &&
      names.some(
        (n) =>
          n === "people.operationalSummary" ||
          n === "people.listAvailabilityExceptions",
      )
    )
      await readGate;
    const out = names.map((n, index) => {
      const input = inputs[index]?.json ?? inputs[index] ?? {};
      requests.push({ name: n, input });
      if (n === "people.listAvailabilityExceptions")
        return { result: { data: { json: periods[input.personId] ?? [] } } };
      if (n === "people.createAvailabilityException") {
        periods[input.personId].push({ ...input, id: "period-1" });
        gateReads();
        return { result: { data: { json: periods[input.personId][0] } } };
      }
      if (n === "people.deleteAvailabilityException") {
        deletes++;
        if (deletes === 1)
          return {
            error: {
              json: {
                message: "Falha simulada na remoção",
                code: -32600,
                data: { code: "BAD_REQUEST", httpStatus: 400, path: n },
              },
            },
          };
        periods[input.personId] = [];
        gateReads();
        return { result: { data: { json: { ok: true } } } };
      }
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
          data = {
            people: [
              person,
              {
                ...person,
                id: "person-2",
                personId: "person-2",
                name: "Pessoa B",
              },
            ],
          };
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
  await page.goto("http://localhost:5173/people");
  const consent = page.getByRole("button", {
    name: "Somente essenciais",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  const open = async (name) => {
    const back = page.getByRole("button", {
      name: "Voltar à equipe",
      exact: true,
    });
    if (await back.isVisible()) {
      await back.click();
      await back.waitFor({ state: "hidden" });
    }
    await page
      .getByRole("button", { name: `Ações de ${name}`, exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Abrir detalhe", exact: true })
      .click();
    await page.getByRole("menu").waitFor({ state: "hidden" });
    await back.waitFor();
    const summary = page.getByText("Disponibilidade e ausências", {
      exact: true,
    });
    if ((await summary.locator("..").getAttribute("open")) === null)
      await summary.click();
    await page.getByLabel("Início", { exact: true }).waitFor();
  };
  const start = page.getByLabel("Início", { exact: true }),
    end = page.getByLabel("Fim", { exact: true }),
    reason = page.getByLabel("Motivo", { exact: true });
  await open(person.name);
  await start.fill("2026-11-20T09:00");
  await end.fill("2026-11-20T08:00");
  await page
    .getByRole("button", { name: "Adicionar indisponibilidade", exact: true })
    .click();
  await page
    .getByText("O fim da indisponibilidade deve ser posterior ao início.", {
      exact: true,
    })
    .waitFor();
  assert.equal(writes.length, 0);
  await end.fill("2026-11-20T10:00");
  await reason.fill("Consulta da pessoa A");
  await open("Pessoa B");
  assert.equal(await reason.inputValue(), "");
  assert.equal(await start.inputValue(), "");
  await start.fill("2026-11-21T13:00");
  await end.fill("2026-11-21T14:00");
  await reason.fill("Rascunho da pessoa B");
  await open(person.name);
  assert.equal(await reason.inputValue(), "Consulta da pessoa A");
  const createStarted = new Promise((resolve) => (started = resolve));
  await page
    .getByRole("button", { name: "Adicionar indisponibilidade", exact: true })
    .evaluate((node) => {
      node.click();
      node.click();
    });
  await createStarted;
  assert.equal(writes.length, 1);
  await open("Pessoa B");
  assert.equal(await reason.inputValue(), "Rascunho da pessoa B");
  releaseWrite();
  await page.waitForFunction(
    (node) => !node.disabled,
    await reason.elementHandle(),
  );
  assert.equal(
    await reason.inputValue(),
    "Rascunho da pessoa B",
    "An A response must not clear the B draft",
  );
  assert(holdReads, "Write pending must end before slow reads");
  const submitted = requests.find(
    (r) => r.name === "people.createAvailabilityException",
  ).input;
  assert.equal(submitted.personId, "person-1");
  assert.equal(submitted.startsAt, "2026-11-20T12:00:00.000Z");
  releaseReads();
  await open(person.name);
  assert.equal(await reason.inputValue(), "");
  const remove = page.getByRole("button", {
    name: `Remover indisponibilidade de ${person.name}`,
    exact: true,
  });
  await remove.waitFor();
  const deleteStarted = new Promise((resolve) => (started = resolve));
  await remove.click();
  await deleteStarted;
  await open("Pessoa B");
  releaseWrite();
  await page.waitForFunction(
    (node) => !node.disabled,
    await reason.elementHandle(),
  );
  assert.equal(
    await page.getByText(/Falha simulada na remoção/).count(),
    0,
    "An A deletion error must not appear for B",
  );
  assert.equal(await reason.inputValue(), "Rascunho da pessoa B");
  await open(person.name);
  await page.getByText(/Falha simulada na remoção/).waitFor();
  const retryStarted = new Promise((resolve) => (started = resolve));
  await remove.click();
  await retryStarted;
  releaseWrite();
  await page.waitForFunction(
    (node) => !node.disabled,
    await reason.elementHandle(),
  );
  assert(
    await remove.isDisabled(),
    "Do not offer deletion of stale records while refreshing",
  );
  releaseReads();
  await remove.waitFor({ state: "hidden" });
  assert.equal(deletes, 2);
  assert.deepEqual(periods["person-1"], []);
  assert.deepEqual(errors, []);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await browser.close();
  console.log(
    "PASS: per-person drafts, validation/timezone, delayed create and delete errors scoped to their person, and no duplicate pending write.",
  );
})().catch(async (error) => {
  console.error(error);
  if (page) console.error(await page.locator("body").innerText());
  process.exit(1);
});
