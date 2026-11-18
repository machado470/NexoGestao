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
              role: "ADMIN",
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
  const prompt = page.getByRole("alertdialog", { name: "Descartar alterações?", exact: true });
  const nav = page.getByRole("navigation", { name: "Navegação principal no celular" });
  const unloadBlocked = () => page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event); return event.defaultPrevented;
  });
  for (const spec of [
    { path: "appointments", button: "Novo agendamento", title: "Novo agendamento", field: "textarea", value: "Visita de diagnóstico: preservar observação" },
    { path: "calendar", button: "Novo agendamento", title: "Novo Agendamento", field: "textarea", value: "Calendário: preservar observação" },
    { path: "service-orders", button: "Nova O.S.", title: "Nova O.S.", field: 'input[placeholder^="Ex: Manutenção"]', value: "Manutenção ainda não salva" },
  ]) {
    await page.goto("http://localhost:5173/profile");
    const consent = page.getByRole("button", { name: "Somente essenciais", exact: true });
    if (await consent.isVisible()) await consent.click();
    if (spec.path === "appointments") {
      await nav.getByRole("button", { name: "Agenda", exact: true }).click();
    } else {
      await nav.getByRole("button", { name: "Mais", exact: true }).click();
      await page.getByRole("navigation", { name: "Todas as áreas" })
        .getByRole("button", { name: spec.path === "calendar" ? "Calendário" : "Ordens de Serviço", exact: true }).click();
      await page.getByRole("dialog", { name: "Mais opções", exact: true }).waitFor({ state: "hidden" });
    }
    await page.waitForURL("**/" + spec.path);
    await page.getByRole("button", { name: spec.button, exact: true }).first().click();
    const form = page.getByRole("dialog", { name: spec.title, exact: true });
    await form.waitFor();
    const field = form.locator(spec.field);
    await field.fill(spec.value);
    const historyLength = await page.evaluate(() => history.length);
    assert.equal(await unloadBlocked(), true);
    await page.evaluate(() => history.back()); await prompt.waitFor();
    assert.equal(new URL(page.url()).pathname, "/" + spec.path);
    await prompt.getByRole("button", { name: "Continuar editando", exact: true }).click();
    await prompt.waitFor({ state: "hidden" });
    assert.equal(await field.inputValue(), spec.value);
    assert.equal(await page.evaluate(() => history.length), historyLength);
    await page.evaluate(() => history.back()); await prompt.waitFor();
    await page.keyboard.press("Escape"); await prompt.waitFor({ state: "hidden" });
    assert.equal(await field.inputValue(), spec.value);
    await page.evaluate(() => history.back()); await prompt.waitFor();
    await page.screenshot({ path: `/workspace/attachments/${spec.path}-navigation-${process.env.MOBILE_WIDTH || 390}.png` });
    await prompt.getByRole("button", { name: "Descartar alterações", exact: true }).click();
    await page.waitForURL("**/profile");
    assert.equal(await form.count(), 0);
    assert.equal(await unloadBlocked(), false);
    await page.evaluate(() => history.forward()); await page.waitForURL("**/" + spec.path);
    await page.getByRole("button", { name: spec.button, exact: true }).first().click();
    await form.waitFor();
    assert.equal(await field.inputValue(), "", "Discarded drafts must not reappear on Forward");
    await form.getByRole("button", { name: "Close", exact: true }).click();
    await form.waitFor({ state: "hidden" });
    assert.equal(await prompt.count(), 0, "Pre-filled context is clean");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log("PASS", process.env.MOBILE_WIDTH || 390, spec.path, "Back keep/Escape/discard, Forward clean, history preserved");
  }
  await page.goto("http://localhost:5173/profile");
  await nav.getByRole("button", { name: "Agenda", exact: true }).click();
  await page.waitForURL("**/appointments");
  const edit = async () => {
    await page.getByRole("button", { name: "Abrir", exact: true }).first().click();
    await page.getByRole("button", { name: "Editar/Remarcar", exact: true }).click();
  };
  await edit();
  const editing = page.getByRole("dialog", { name: "Editar agendamento", exact: true });
  await editing.waitFor();
  const originalNotes = await editing.locator("textarea").inputValue();
  assert.equal(await editing.getByLabel("Hora", { exact: true }).inputValue(), "09:00");
  await editing.locator("textarea").fill("Remarcação ainda não salva");
  await page.evaluate(() => history.back()); await prompt.waitFor();
  await prompt.getByRole("button", { name: "Continuar editando", exact: true }).click();
  await prompt.waitFor({ state: "hidden" });
  assert.equal(await editing.locator("textarea").inputValue(), "Remarcação ainda não salva");
  assert.equal(await editing.getByLabel("Hora", { exact: true }).inputValue(), "09:00");
  await page.evaluate(() => history.back()); await prompt.waitFor();
  await prompt.getByRole("button", { name: "Descartar alterações", exact: true }).click();
  await page.waitForURL("**/profile");
  await page.evaluate(() => history.forward()); await page.waitForURL("**/appointments");
  await edit(); await editing.waitFor();
  assert.equal(await editing.locator("textarea").inputValue(), originalNotes);
  await page.keyboard.press("Escape"); await editing.waitFor({ state: "hidden" });
  assert.equal(await prompt.count(), 0);
  console.log("PASS", process.env.MOBILE_WIDTH || 390, "existing appointment Back preserves edits/date, discard leaves persisted data intact");
  assert.deepEqual(writes, [], "Navigation and discard cannot write records");
  assert.deepEqual(errors, []);
  await browser.close();
})().catch(async error => { console.error(error); if (page) console.log((await page.locator("body").innerText()).slice(-2000)); process.exit(1); });
