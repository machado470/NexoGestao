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
    viewport: { width: 390, height: 844 },
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

  page.setDefaultTimeout(8000);
  let nativeDialogs = [];
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.type());
    await dialog.dismiss();
  });
  async function visit(path) {
    await page.goto("http://localhost:5173/" + path);
    await page
      .getByText("Horários em America/Sao_Paulo", { exact: true })
      .waitFor();
    const consent = page.getByRole("button", {
      name: "Somente essenciais",
      exact: true,
    });
    if (await consent.isVisible()) await consent.click();
  }
  async function expectConfirmation() {
    const alert = page.getByRole("alertdialog", {
      name: "Descartar alterações?",
    });
    await alert.waitFor();
    assert.equal(
      await alert
        .getByRole("button", { name: "Continuar editando" })
        .evaluate((node) => node === document.activeElement),
      true,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    return alert;
  }
  async function exercise({ path, button, title, field, value }) {
    if (process.env.FORM_CASE && path !== process.env.FORM_CASE) return;
    await visit(path);
    const open = () =>
      page
        .getByRole("button", { name: button, exact: true })
        .and(page.locator(":visible"))
        .first()
        .click();
    await open();
    let form = page.getByRole("dialog", { name: title, exact: true });
    await form.waitFor();
    // Defaults and contextual values alone are not user changes.
    await page.keyboard.press("Escape");
    await form.waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("alertdialog").count(), 0);
    await open();
    form = page.getByRole("dialog", { name: title, exact: true });
    const input = form.locator(field);
    const initial = await input.inputValue();
    await input.fill(value);
    assert.equal(
      await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }),
      true,
    );
    await form.getByRole("button", { name: "Cancelar", exact: true }).click();
    let alert = await expectConfirmation();
    await alert.getByRole("button", { name: "Continuar editando" }).click();
    await alert.waitFor({ state: "hidden" });
    assert.equal(await input.inputValue(), value);
    await input.focus();
    await page.keyboard.press("Escape");
    alert = await expectConfirmation();
    await page.keyboard.press("Escape");
    await alert.waitFor({ state: "hidden" });
    assert.equal(await input.inputValue(), value);
    assert.equal(
      await input.evaluate((node) => node === document.activeElement),
      true,
    );
    await form.getByRole("button", { name: "Close", exact: true }).click();
    alert = await expectConfirmation();
    await alert.getByRole("button", { name: "Continuar editando" }).click();
    await alert.waitFor({ state: "hidden" });
    await page.mouse.click(2, 2);
    alert = await expectConfirmation();
    await alert
      .getByRole("button", { name: "Descartar alterações", exact: true })
      .click();
    await form.waitFor({ state: "hidden" });
    await open();
    assert.equal(
      await page
        .getByRole("dialog", { name: title, exact: true })
        .locator(field)
        .inputValue(),
      initial,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }),
      false,
    );
    console.log(
      path,
      title,
      "clean close / Cancel / Escape / X / outside / keep / discard / reset / unload passed",
    );
  }
  for (const width of [320, 390, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    await exercise({
      path: "appointments",
      button: "Novo agendamento",
      title: "Novo agendamento",
      field: "textarea",
      value: "Rascunho de agendamento",
    });
    await exercise({
      path: "calendar",
      button: "Novo agendamento",
      title: "Novo Agendamento",
      field: "textarea",
      value: "Rascunho do calendário",
    });
    await exercise({
      path: "customers",
      button: "Novo cliente",
      title: "Novo Cliente",
      field: "#customer-name",
      value: "Cliente ainda não salvo",
    });
    await exercise({
      path: "service-orders",
      button: "Nova O.S.",
      title: "Nova O.S.",
      field: 'input[placeholder^="Ex: Manutenção"]',
      value: "Serviço ainda não salvo",
    });
    await exercise({
      path: "finances",
      button: "Nova cobrança",
      title: "Nova cobrança",
      field: 'input[inputmode="decimal"]',
      value: "123,45",
    });
  }

  if (!process.env.FORM_CASE || process.env.FORM_CASE === "appointments") {
    await page.setViewportSize({ width: 390, height: 844 });
    await visit("appointments");
    await page
      .getByRole("button", { name: "Abrir", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Editar/Remarcar", exact: true })
      .click();
    let form = page.getByRole("dialog", {
      name: "Editar agendamento",
      exact: true,
    });
    await form.waitFor();
    assert.equal(
      await form.locator('input[type="time"]').inputValue(),
      "09:00",
    );
    await page.keyboard.press("Escape");
    await form.waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("alertdialog").count(), 0);
    await page
      .getByRole("button", { name: "Editar/Remarcar", exact: true })
      .click();
    form = page.getByRole("dialog", {
      name: "Editar agendamento",
      exact: true,
    });
    const original = await form.locator("textarea").inputValue();
    await form.locator("textarea").fill("Alteração do agendamento existente");
    await page.keyboard.press("Escape");
    let alert = await expectConfirmation();
    await alert.getByRole("button", { name: "Continuar editando" }).click();
    await alert.waitFor({ state: "hidden" });
    assert.equal(
      await form.locator("textarea").inputValue(),
      "Alteração do agendamento existente",
    );
    await form.getByRole("button", { name: "Cancelar", exact: true }).click();
    alert = await expectConfirmation();
    await alert
      .getByRole("button", { name: "Descartar alterações", exact: true })
      .click();
    await form.waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "Editar/Remarcar", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("dialog", { name: "Editar agendamento", exact: true })
        .locator("textarea")
        .inputValue(),
      original,
    );
    await page.keyboard.press("Escape");
    console.log(
      "editing existing appointment: clean baseline, preserve changes, discard without changing persisted data passed",
    );
  }
  if (!process.env.FORM_CASE) {
    await visit("appointments");
    await page
      .getByRole("button", { name: "Novo agendamento", exact: true })
      .first()
      .click();
    const form = page.getByRole("dialog", {
      name: "Novo agendamento",
      exact: true,
    });
    await form.getByRole("combobox").first().click();
    await page.getByRole("option", { name, exact: true }).click();
    await form.locator('input[type="date"]').fill("2026-11-20");
    await form.locator('input[type="time"]').fill("09:30");
    await form.locator("textarea").fill("Manter após erro de gravação");
    let release, signalStarted;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const started = new Promise((resolve) => {
      signalStarted = resolve;
    });
    let simulatedSaves = 0;
    await page.route("**/api/trpc/appointments.create**", async (route) => {
      simulatedSaves++;
      if (simulatedSaves === 1) {
        signalStarted();
        await gate;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify([
            {
              error: {
                json: {
                  message: "Falha simulada de gravação",
                  code: -32603,
                  data: {
                    code: "INTERNAL_SERVER_ERROR",
                    httpStatus: 500,
                    path: "appointments.create",
                  },
                },
              },
            },
          ]),
        });
      } else {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify([
            {
              result: { data: { json: { ...appt, id: "saved-appointment" } } },
            },
          ]),
        });
      }
    });
    await form.getByRole("button", { name: "Salvar", exact: true }).click();
    await Promise.race([
      started,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Simulated save did not start")),
          8000,
        ),
      ),
    ]);
    await page.keyboard.press("Escape");
    await form.getByRole("button", { name: "Cancelar", exact: true }).click();
    await form.getByRole("button", { name: "Close", exact: true }).click();
    assert.equal(await form.isVisible(), true);
    assert.equal(await page.getByRole("alertdialog").count(), 0);
    release();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some(
        (b) => b.textContent === "Salvar" && !b.disabled,
      ),
    );
    assert.equal(
      await form.locator("textarea").inputValue(),
      "Manter após erro de gravação",
    );
    await form.getByRole("button", { name: "Salvar", exact: true }).click();
    await form.waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("alertdialog").count(), 0);
    assert.equal(simulatedSaves, 2);
    console.log(
      "pending blocks dismiss; failed save preserves draft; successful save closes directly (intercepted fixtures)",
    );
  }
  assert.deepEqual(nativeDialogs, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  await browser.close();
  console.log("PASSED: no native confirmation, no writes, no page errors");
})().catch(async (error) => {
  console.error(error);
  if (page) {
    console.log((await page.locator("body").innerText()).slice(0, 3000));
    await page.context().browser()?.close();
  }
  process.exitCode = 1;
});
