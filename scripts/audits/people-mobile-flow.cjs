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
  const attempts = {};
  let personReads = 0;
  let releaseWrite,
    writeStarted,
    holdSummary = false,
    releaseSummary;
  let summaryGate;
  const version = "2026-11-18T10:00:00.000Z";

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
    const mutation = names.find((name) =>
      ["people.create", "people.update"].includes(name),
    );
    if (mutation && !attempts[mutation])
      await new Promise((resolve) => {
        releaseWrite = resolve;
        writeStarted?.();
      });
    if (holdSummary && names.includes("people.operationalSummary"))
      await summaryGate;
    const out = names.map((n, index) => {
      if (["people.create", "people.update"].includes(n)) {
        attempts[n] = (attempts[n] || 0) + 1;
        if (attempts[n] === 1)
          return {
            error: {
              json: {
                message: "Cadastro recusado na simulação",
                code: -32600,
                data: { code: "BAD_REQUEST", httpStatus: 400, path: n },
              },
            },
          };
        Object.assign(person, inputs[index]?.json ?? inputs[index], {
          active: true,
          updatedAt: version,
        });
        holdSummary = true;
        summaryGate = new Promise((resolve) => {
          releaseSummary = () => {
            holdSummary = false;
            resolve();
          };
        });
        return { result: { data: { json: person } } };
      }
      if (n === "people.getById" && ++personReads <= 2)
        return {
          error: {
            json: {
              message: "Leitura indisponível na simulação",
              code: -32603,
              data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 503, path: n },
            },
          },
        };
      if (n === "people.getById")
        return {
          result: {
            data: { json: { ...person, active: true, updatedAt: version } },
          },
        };
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

  page.setDefaultTimeout(15000);
  await page.goto("http://localhost:5173/people");
  const consent = page.getByRole("button", {
    name: "Somente essenciais",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole("button", { name: "Nova pessoa", exact: true }).click();
  const create = page.getByRole("dialog", { name: "Nova pessoa", exact: true });
  await create
    .getByLabel("Nome", { exact: true })
    .fill("Pessoa do teste mobile");
  await create.getByLabel("Cargo / Papel", { exact: true }).fill("Técnica");
  await page.keyboard.press("Escape");
  const confirmation = page.getByRole("alertdialog", {
    name: "Descartar alterações?",
    exact: true,
  });
  await confirmation
    .getByRole("button", { name: "Continuar editando", exact: true })
    .click();
  assert.equal(
    await create.getByLabel("Nome", { exact: true }).inputValue(),
    "Pessoa do teste mobile",
  );
  const createStarted = new Promise((resolve) => {
    writeStarted = resolve;
  });
  await create
    .getByRole("button", { name: "Criar pessoa", exact: true })
    .evaluate((node) => {
      node.click();
      node.click();
    });
  await createStarted;
  assert(await create.getByLabel("Nome", { exact: true }).isDisabled());
  assert(
    await create
      .getByRole("button", { name: "Cancelar", exact: true })
      .isDisabled(),
  );
  await page.keyboard.press("Escape");
  assert(await create.isVisible());
  assert.equal(writes.filter((n) => n === "people.create").length, 1);
  releaseWrite();
  await page
    .getByText("Cadastro recusado na simulação", { exact: true })
    .waitFor();
  assert.equal(
    await create.getByLabel("Nome", { exact: true }).inputValue(),
    "Pessoa do teste mobile",
  );
  await create
    .getByRole("button", { name: "Criar pessoa", exact: true })
    .click();
  await create.waitFor({ state: "hidden" });
  assert(holdSummary, "Confirmed creation must close before a slow refresh");
  releaseSummary();
  await page
    .getByRole("button", { name: `Ações de ${person.name}`, exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Editar pessoa", exact: true })
    .click();
  const edit = page.getByRole("dialog", { name: "Editar pessoa", exact: true });
  await edit
    .getByText("Não foi possível carregar os dados da pessoa.", { exact: true })
    .waitFor();
  await edit
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  const field = edit.getByLabel("Nome", { exact: true });
  await field.waitFor();
  await page.waitForFunction(
    (node) => node.value === "Pessoa do teste mobile",
    await field.elementHandle(),
  );
  await page.screenshot({path:`/workspace/attachments/people-edit-${process.env.MOBILE_WIDTH || 390}.png`,animations:"disabled"});
  await field.fill("Rascunho a preservar");
  await page.keyboard.press("Escape");
  await confirmation
    .getByRole("button", { name: "Continuar editando", exact: true })
    .click();
  assert.equal(await field.inputValue(), "Rascunho a preservar");
  await edit.getByRole("button", { name: "Descartar", exact: true }).click();
  await confirmation.waitFor();
  await page.keyboard.press("Escape");
  await confirmation.waitFor({ state: "hidden" });
  assert.equal(await field.inputValue(), "Rascunho a preservar");
  await edit.getByRole("button", { name: "Descartar", exact: true }).click();
  await confirmation
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  assert.equal(await field.inputValue(), "Pessoa do teste mobile");
  assert(
    await edit.isVisible(),
    "Discarding fields should not close the editor",
  );
  await field.fill("Pessoa atualizada no celular");
  const editStarted = new Promise((resolve) => {
    writeStarted = resolve;
  });
  await edit
    .getByRole("button", { name: "Salvar", exact: true })
    .evaluate((node) => {
      node.click();
      node.click();
    });
  await editStarted;
  assert(await field.isDisabled());
  assert.equal(writes.filter((n) => n === "people.update").length, 1);
  releaseWrite();
  await page
    .getByText("Cadastro recusado na simulação", { exact: true })
    .waitFor();
  assert.equal(await field.inputValue(), "Pessoa atualizada no celular");
  await edit.getByRole("button", { name: "Salvar", exact: true }).click();
  await edit.waitFor({ state: "hidden" });
  assert(holdSummary, "Confirmed update must close before a slow refresh");
  releaseSummary();
  assert.equal(person.name, "Pessoa atualizada no celular");
  assert.equal(attempts["people.create"], 2);
  assert.equal(attempts["people.update"], 2);
  await page
    .getByRole("button", { name: `Ações de ${person.name}`, exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Abrir detalhe", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Voltar à equipe", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Ações de ${person.name}`, exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await browser.close();
  console.log(
    "PASS: People create/edit discard confirmation, pending fields, double submit, rejected save preservation and confirmation before slow refresh.",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
