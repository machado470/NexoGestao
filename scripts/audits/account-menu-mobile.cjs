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
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
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
  const contrast = async locator => locator.evaluate(node => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    const menu = node.closest('[role="menu"]');
    ctx.fillStyle = getComputedStyle(menu).backgroundColor; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = getComputedStyle(node).backgroundColor; ctx.fillRect(0, 0, 1, 1);
    const bg = [...ctx.getImageData(0, 0, 1, 1).data];
    ctx.fillStyle = getComputedStyle(node).color; ctx.fillRect(0, 0, 1, 1);
    const fg = [...ctx.getImageData(0, 0, 1, 1).data];
    const lum = rgb => rgb.slice(0, 3).map(v => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    return (Math.max(lum(bg), lum(fg)) + .05) / (Math.min(lum(bg), lum(fg)) + .05);
  });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("http://localhost:5173/profile");
    await page.getByText("Horários em America/Sao_Paulo", { exact: true }).waitFor();
    const consent = page.getByRole("button", { name: "Somente essenciais", exact: true });
    if (await consent.isVisible()) await consent.click();
    for (const theme of ["light", "dark"]) {
      await page.getByRole("button", { name: "Minha conta", exact: true }).click();
      const menu = page.getByRole("menu"); await menu.waitFor();
      await menu.screenshot({ animations: "disabled" });
      assert(await contrast(menu.getByText("Admin", { exact: true })) >= 4.5, "Account name contrast");
      for (const label of ["Perfil", "Tema", "Sair"]) {
        const item = menu.getByRole("menuitem", { name: label, exact: true });
        assert((await item.boundingBox()).height >= 44, `${label} touch target`);
        assert(await contrast(item) >= 4.5, `${label} normal contrast`);
        await item.focus();
        assert(await contrast(item) >= 4.5, `${label} focused contrast`);
      }
      const box = await menu.boundingBox(); assert(box.x >= 0 && box.x + box.width <= width);
      await page.screenshot({ path: `/workspace/attachments/account-menu-${width}-${theme}.png`, animations: "disabled" });
      if (theme === "light") {
        await menu.getByRole("menuitem", { name: "Perfil", exact: true }).focus();
        await page.keyboard.press("ArrowDown");
        await page.waitForFunction(() => document.activeElement?.textContent.trim() === "Tema");
        await page.keyboard.press("Enter"); await menu.waitFor({ state: "hidden" });
        await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
      } else {
        await menu.getByRole("menuitem", { name: "Perfil", exact: true }).click();
        await menu.waitFor({ state: "hidden" }); assert.equal(new URL(page.url()).pathname, "/profile");
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      console.log("PASS", width, theme, "account name/action contrast >=4.5, focus, 44px targets, theme keyboard and profile navigation");
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
