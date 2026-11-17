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
  let mode = "ok",
    failingName = "",
    attempts = 0,
    releaseRead;
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
  await page.addInitScript(() => {
    if (!localStorage.getItem("theme")) localStorage.setItem("theme", "dark");
  });
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
    if (mode === "gated" && names.includes(failingName)) {
      await new Promise((resolve) => {
        releaseRead = resolve;
      });
    }
    const out = names.map((n) => {
      if (n === failingName) {
        attempts++;
        if (
          (mode === "transient" && attempts === 1) ||
          mode === "persistent" ||
          mode === "forbidden"
        ) {
          const httpStatus = mode === "forbidden" ? 403 : 503;
          return {
            error: {
              json: {
                message: "Falha simulada de leitura",
                code: -32603,
                data: {
                  code:
                    httpStatus === 403 ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR",
                  httpStatus,
                  path: n,
                },
              },
            },
          };
        }
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

  page.setDefaultTimeout(12000);
  await page.addInitScript(() => {
    window.errorFlashed = false;
    new MutationObserver(() => {
      if (
        /A carteira financeira está indisponível|Não foi possível carregar|Falha simulada de leitura/.test(
          document.body?.innerText || "",
        )
      )
        window.errorFlashed = true;
    }).observe(document, { childList: true, subtree: true });
  });
  for (const [path, read, ready] of [
    ["customers", "customers.page", "Novo cliente"],
    ["appointments", "appointments.page", "Novo agendamento"],
    ["service-orders", "serviceOrders.page", "Nova O.S."],
    ["finances", "finance.charges.list", "Nova cobrança"],
  ]) {
    mode = "transient";
    failingName = read;
    attempts = 0;
    const recovered = page.waitForResponse(async (response) => {
      if (!response.url().includes("/api/trpc/")) return false;
      const names = new URL(response.url()).pathname
        .split("/api/trpc/")[1]
        .split(",");
      const index = names.indexOf(read);
      if (index < 0) return false;
      const body = await response.json();
      return Boolean(body[index]?.result);
    });
    await page.goto("http://localhost:5173/" + path);
    await recovered;
    await page
      .getByRole("button", { name: ready, exact: true })
      .first()
      .waitFor();
    await page.waitForFunction(
      () => !document.body.innerText.includes("Carregando carteira oficial"),
    );
    assert.equal(attempts, 2, path + " should recover with just one retry");
    assert.equal(
      await page.evaluate(() => window.errorFlashed),
      false,
      path + " must not flash a blocking error",
    );
  }
  mode = "persistent";
  failingName = "appointments.page";
  attempts = 0;
  await page.goto("http://localhost:5173/appointments");
  await page
    .getByText("Não foi possível carregar os agendamentos.", { exact: true })
    .waitFor();
  mode = "gated";
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await page.getByText("Carregando agendamentos...", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByText("Não foi possível carregar os agendamentos.", { exact: true })
      .count(),
    0,
  );
  releaseRead();
  await page.getByText(appt.title, { exact: true }).first().waitFor();
  mode = "persistent";
  failingName = "finance.charges.list";
  attempts = 0;
  await page.goto("http://localhost:5173/finances");
  await page
    .getByText(
      "A carteira financeira está indisponível. Sua sessão continua válida.",
      { exact: true },
    )
    .waitFor();
  assert.equal(attempts, 2, "Persistent failures must stop after two attempts");
  mode = "gated";
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await page
    .getByText("Carregando carteira oficial", { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByText(
        "A carteira financeira está indisponível. Sua sessão continua válida.",
        { exact: true },
      )
      .count(),
    0,
  );
  releaseRead();
  await page
    .getByRole("button", { name: "Nova cobrança", exact: true })
    .first()
    .waitFor();
  mode = "forbidden";
  attempts = 0;
  await page.reload();
  await page
    .getByText(
      "A carteira financeira está indisponível. Sua sessão continua válida.",
      { exact: true },
    )
    .waitFor();
  assert.equal(attempts, 1, "Permission errors must never be retried");
  mode = "ok";
  failingName = "";
  await page.reload();
  await page
    .getByRole("button", { name: "Nova cobrança", exact: true })
    .first()
    .waitFor();
  const consent = page.getByRole("button", {
    name: "Somente essenciais",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  for (const theme of ["dark", "light"]) {
    await page.evaluate((theme) => {
      localStorage.setItem("theme", theme);
    }, theme);
    await page.reload();
    await page
      .getByRole("button", { name: "Nova cobrança", exact: true })
      .first()
      .waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.dataset.theme),
      theme,
    );
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.getByRole("button", { name: "Mais", exact: true }).click();
      const menu = page.getByRole("dialog", {
        name: "Mais opções",
        exact: true,
      });
      await menu.waitFor();
      const styles = await menu.evaluate((node) => {
        const color = getComputedStyle(node).backgroundColor;
        const text = getComputedStyle(node).color;
        const overlay = getComputedStyle(
          document.querySelector('[data-slot="dialog-overlay"]'),
        ).backgroundColor;
        const box = node.getBoundingClientRect();
        return {
          color,
          text,
          overlay,
          width: box.width,
          height: box.height,
          viewport: innerWidth,
          viewportHeight: innerHeight,
          scrolls: node.scrollHeight > node.clientHeight,
        };
      });
      assert.notEqual(
        styles.color,
        styles.text,
        "Text and surface must remain distinct",
      );
      assert(
        !styles.color.includes("rgba") && styles.color !== "transparent",
        JSON.stringify(styles),
      );
      assert(
        styles.overlay !== "rgba(0, 0, 0, 0)" &&
          styles.overlay !== "transparent",
        JSON.stringify(styles),
      );
      assert(
        styles.width <= width && styles.height <= 844,
        JSON.stringify(styles),
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await menu
        .getByRole("button", { name: "Configurações", exact: true })
        .scrollIntoViewIfNeeded();
      if (width === 390) {
        await menu.evaluate((node) =>
          node.scrollTo({ top: 0, behavior: "instant" }),
        );
        await page.screenshot({
          path: `/workspace/attachments/menu-mais-${theme}.png`,
          animations: "disabled",
        });
      }
      await page.keyboard.press("Escape");
      await menu.waitFor({ state: "hidden" });
    }
    // Search is a separate portal and must have the same opaque surface.
    await page
      .getByRole("button", { name: "Buscar", exact: true })
      .first()
      .click();
    const search = page.getByRole("dialog", { name: "Buscar", exact: true });
    await search.waitFor();
    assert.notEqual(
      await search.evaluate((node) => getComputedStyle(node).backgroundColor),
      "rgba(0, 0, 0, 0)",
    );
    await page.keyboard.press("Escape");
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  await browser.close();
  console.log(
    "PASS: More/Search opaque in both themes at 320/390/430px; transient recovery, bounded persistent error, retry loading and no permission retry; zero writes.",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
