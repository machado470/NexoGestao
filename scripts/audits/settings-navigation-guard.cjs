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
  let pendingSave;
  let failNextSave = true;
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
    if (names.includes("settings.update") && failNextSave) {
      failNextSave = false;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([
          {
            error: {
              json: {
                message: "Falha simulada ao salvar",
                code: -32603,
                data: {
                  code: "INTERNAL_SERVER_ERROR",
                  httpStatus: 500,
                  path: "settings.update",
                },
              },
            },
          },
        ]),
      });
      return;
    }
    if (names.includes("settings.update")) {
      await new Promise((resolve) => {
        pendingSave = resolve;
      });
      const payload = JSON.parse(request.postData());
      Object.assign(savedSettings, payload[0]?.json ?? payload[0]);
    }
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
      "settings.update": savedSettings,
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
  const assertPath = async (path) =>
    assert.equal(new URL(page.url()).pathname, path);
  const dialog = page.getByRole("alertdialog");
  const cancel = () =>
    dialog.getByRole("button", { name: "Continuar editando" }).click();
  const discard = () =>
    dialog
      .getByRole("button", { name: "Descartar alterações", exact: true })
      .click();
  const goSettings = async () => {
    await page.getByRole("button", { name: "Mais", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Todas as áreas" })
      .getByRole("button", { name: "Configurações", exact: true })
      .click();
    await page.locator("#settings-name").waitFor();
  };
  await page.goto("http://localhost:5173/profile");
  await page
    .getByRole("button", { name: "Somente essenciais", exact: true })
    .click();
  await goSettings();
  await page.locator("#settings-name").fill("Edição protegida");
  const entriesBefore = await page.evaluate(() => history.length);
  await page.getByRole("button", { name: "Minha conta", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await dialog.waitFor();
  await cancel();
  await assertPath("/settings");
  assert.equal(
    writes.length,
    0,
    "Canceling logout must not send a logout request",
  );
  await page
    .getByRole("navigation", { name: "Navegação principal no celular" })
    .getByRole("button", { name: "Clientes", exact: true })
    .click();
  await dialog.waitFor();
  await page.screenshot({
    path: "/workspace/attachments/protecao-edicoes-mobile.png",
    animations: "disabled",
  });
  await assertPath("/settings");
  await cancel();
  assert.equal(
    await page.locator("#settings-name").inputValue(),
    "Edição protegida",
  );
  assert.equal(await page.evaluate(() => history.length), entriesBefore);
  await page
    .getByRole("navigation", { name: "Navegação principal no celular" })
    .getByRole("button", { name: "Clientes", exact: true })
    .click();
  await dialog.waitFor();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await assertPath("/settings");
  assert.equal(
    await page.locator("#settings-name").inputValue(),
    "Edição protegida",
  );
  await page.evaluate(() => history.back());
  await dialog.waitFor();
  await assertPath("/settings");
  await cancel();
  assert.equal(
    await page.locator("#settings-name").inputValue(),
    "Edição protegida",
  );
  assert.equal(await page.evaluate(() => history.length), entriesBefore);
  await page.evaluate(() => history.back());
  await dialog.waitFor();
  await discard();
  await page.waitForURL("**/profile");
  await page.evaluate(() => history.forward());
  await page.waitForURL("**/settings");
  await page.locator("#settings-name").waitFor();
  assert.equal(
    await page.locator("#settings-name").inputValue(),
    savedSettings.name,
  );
  assert.equal(await dialog.count(), 0);
  await page.locator("#settings-name").fill("Outra edição");
  await page.getByRole("button", { name: "Mais", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Todas as áreas" })
    .getByRole("button", { name: "Perfil", exact: true })
    .click();
  await dialog.waitFor();
  await discard();
  await page.waitForURL("**/profile");
  await goSettings();
  assert.equal(await dialog.count(), 0);
  assert.equal(
    writes.length,
    0,
    "Navigation and discard must not save or logout",
  );
  await page.locator("#settings-name").fill("Nome confirmado");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await page
    .getByText(
      "A alteração não foi salva. Revise os dados e tente novamente.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await page.locator("#settings-name").inputValue(),
    "Nome confirmado",
  );
  await page
    .getByRole("navigation", { name: "Navegação principal no celular" })
    .getByRole("button", { name: "Clientes", exact: true })
    .click();
  await dialog.waitFor();
  await cancel();
  await assertPath("/settings");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Salvando...", exact: true })
    .waitFor();
  await page
    .getByRole("navigation", { name: "Navegação principal no celular" })
    .getByRole("button", { name: "Clientes", exact: true })
    .click();
  await assertPath("/settings");
  assert.equal(await dialog.count(), 0);
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => location.pathname === "/settings");
  assert.equal(await dialog.count(), 0);
  pendingSave();
  await page
    .getByText("Configurações salvas e confirmadas pela fonte oficial.", {
      exact: true,
    })
    .waitFor();
  assert.equal(savedSettings.name, "Nome confirmado");
  assert.equal(
    await page.locator("#settings-name").inputValue(),
    "Nome confirmado",
  );
  await page.getByRole("button", { name: "Mais", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Todas as áreas" })
    .getByRole("button", { name: "Perfil", exact: true })
    .click();
  await page.waitForURL("**/profile");
  assert.equal(await dialog.count(), 0);
  assert.deepEqual(writes, ["settings.update", "settings.update"]);
  await page.evaluate(() => history.back());
  await page.waitForURL("**/settings");
  await page.locator("#settings-name").fill("Edição antes de avançar");
  await page.evaluate(() => history.forward());
  await dialog.waitFor();
  await assertPath("/settings");
  await cancel();
  assert.equal(
    await page.locator("#settings-name").inputValue(),
    "Edição antes de avançar",
  );
  await page.evaluate(() => history.forward());
  await dialog.waitFor();
  await discard();
  await page.waitForURL("**/profile");
  // Confirmed logout is authorized only after the discard decision.
  await goSettings();
  await page.locator("#settings-name").fill("Edição antes de sair");
  await page.getByRole("button", { name: "Minha conta", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await dialog.waitFor();
  assert.deepEqual(writes, ["settings.update", "settings.update"]);
  await discard();
  await page.waitForURL("**/login?logoutAt=*");
  assert.deepEqual(writes, [
    "settings.update",
    "settings.update",
    "session.logout",
  ]);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: route cancel/discard, Back cancel/discard, Forward, intact history, pending save and clean save navigation.",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
