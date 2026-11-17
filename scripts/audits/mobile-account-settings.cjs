// Local fixture audit. No production requests or writes.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    timezoneId: "UTC",
    isMobile: true,
    hasTouch: true,
  });
  const errors = [],
    writes = [];
  const savedSettings = {
    id: "org-1",
    name: "Organização de Serviços com Nome Longo",
    slug: "organizacao",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
  };
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.route("**/api/consent", (r) =>
    r.fulfill({ contentType: "application/json", body: '{"success":true}' }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const request = route.request();
    const names = new URL(request.url()).pathname
      .split("/api/trpc/")[1]
      .split(",");
    if (request.method() === "POST") writes.push(...names);
    const fixture = {
      "session.me": {
        user: {
          id: "user-1",
          organizationId: "org-1",
          name: "Admin",
          email: "admin@example.test",
          role: "ADMIN",
        },
        requiresOnboarding: false,
      },
      "auth.me": {
        id: "user-1",
        name: "Profissional com Nome Completo Longo",
        email: "profissional@example.test",
        role: "ADMIN",
        personId: "person-1",
        active: true,
        organization: { id: "org-1", name: savedSettings.name },
      },
      "settings.get": savedSettings,
      "settings.displayPreferences": {
        timezone: "America/Sao_Paulo",
        currency: "BRL",
      },
      "people.operationalSummary": {
        people: [
          {
            personId: "person-1",
            status: "ACTIVE",
            operationalStatus: "NORMAL",
            priority: "P3",
            openServiceOrdersCount: 1,
            overdueServiceOrdersCount: 0,
            todayAppointmentsCount: 1,
            futureAppointmentsCount: 2,
            lastActivityAt: "2026-11-17T12:00:00Z",
          },
        ],
      },
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        names.map((name) => ({
          result: { data: { json: fixture[name] ?? [] } },
        })),
      ),
    });
  });
  page.setDefaultTimeout(12000);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/profile", "/settings"]) {
      await page.goto("http://localhost:5173" + path);
      await page
        .locator(path === "/profile" ? "#profile-name" : "#settings-name")
        .waitFor();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} overflows at ${width}`,
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:5173/settings");
  await page.locator("#settings-name").fill("Nome editado");
  await page
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  await page.getByRole("alertdialog").waitFor();
  await page.getByRole("button", { name: "Continuar editando" }).click();
  assert.equal(
    await page.locator("#settings-name").inputValue(),
    "Nome editado",
  );
  await page
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  assert.equal(
    await page.locator("#settings-name").inputValue(),
    savedSettings.name,
  );
  assert.equal(writes.length, 0, "Reading and discarding must not write");
  await page.locator("#settings-name").fill("Nome preservado ao recarregar");
  let protectedReload = false;
  page.once("dialog", async (dialog) => {
    protectedReload = dialog.type() === "beforeunload";
    await dialog.dismiss();
  });
  await page.reload().catch(() => {});
  assert(protectedReload, "Dirty form must warn before reload");
  assert.equal(
    await page.locator("#settings-name").inputValue(),
    "Nome preservado ao recarregar",
  );
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "instant" });
  });
  const consent = page.getByRole("button", {
    name: "Somente essenciais",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  await page.screenshot({
    path: "/workspace/attachments/configuracoes-app-mobile.png",
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  await page.goto("http://localhost:5173/profile");
  await page.locator("#profile-name").waitFor();
  assert(
    (await page.locator("#profile-name").getAttribute("readonly")) !== null,
  );
  await page.screenshot({
    path: "/workspace/attachments/perfil-app-mobile.png",
    animations: "disabled",
  });
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: Profile/Settings at 320/390/768/1280px, readonly identity, discard/cancel, reload guard, zero writes.",
  );
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
