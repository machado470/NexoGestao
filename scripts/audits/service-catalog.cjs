// Browser auth/context are simulated; catalog reads/writes use the isolated real HTTP API.
const { chromium } = require("playwright");
const fs = require("node:fs"),
  assert = require("node:assert/strict");
let auditPage;
(async () => {
  const fixture = JSON.parse(
    fs.readFileSync("/dev/shm/nexo-commerce-fixture.json", "utf8"),
  );
  const width = Number(process.env.MOBILE_WIDTH || 390),
    writes = [],
    errors = [];
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    isMobile: width < 768,
    hasTouch: width < 768,
  });
  auditPage = page;
  page.setDefaultTimeout(30000);
  let role = "MANAGER",
    loseCreate = true,
    loseEdit = true;
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    (theme) => localStorage.setItem("theme", theme),
    process.env.AUDIT_THEME || "dark",
  );
  await page.route("**/api/consent", (r) =>
    r.fulfill({ contentType: "application/json", body: '{"success":true}' }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      names = url.pathname.split("/api/trpc/")[1].split(",");
    const inputs = JSON.parse(
        req.method() === "POST"
          ? req.postData() || "{}"
          : url.searchParams.get("input") || "{}",
      ),
      out = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i],
        input = inputs[i]?.json ?? inputs[i] ?? {};
      if (name.startsWith("serviceCatalog.")) {
        const operation = name.split(".")[1];
        let path = "/service-catalog";
        if (operation === "list")
          path += `?page=${input.page}&q=${encodeURIComponent(input.q)}&state=${input.state}`;
        else if (operation === "history")
          path += `/${input.id}/history?page=${input.page}`;
        else if (operation === "edit") path += "/" + input.id;
        const { id, ...body } = input;
        const response = await page.request.fetch(
          "http://127.0.0.1:55440" + path,
          {
            method: req.method(),
            headers: { "x-audit-org": fixture.orgId, "x-audit-role": role },
            ...(req.method() === "POST" ? { data: body } : {}),
          },
        );
        let data = await response.json(),
          failed = !response.ok();
        if (req.method() === "POST") {
          writes.push({ operation, input });
          if (
            !failed &&
            ((operation === "create" && loseCreate) ||
              (operation === "edit" && loseEdit))
          ) {
            if (operation === "create") loseCreate = false;
            else loseEdit = false;
            failed = true;
            data = { message: "Resposta perdida após salvar no catálogo" };
          }
        }
        out.push(
          failed
            ? {
                error: {
                  json: {
                    message: String(data.message),
                    code: -32603,
                    data: {
                      code: "INTERNAL_SERVER_ERROR",
                      httpStatus: 503,
                      path: name,
                    },
                  },
                },
              }
            : { result: { data: { json: data } } },
        );
        continue;
      }
      assert(req.method() !== "POST", "Unexpected write " + name);
      const data =
        {
          "session.me": {
            user: {
              id: fixture.actor,
              organizationId: fixture.orgId,
              name: "Gestora",
              email: "local@example.test",
              role,
            },
            requiresOnboarding: false,
          },
          "auth.me": { id: fixture.actor, role },
          "settings.displayPreferences": {
            timezone: "America/Sao_Paulo",
            currency: "BRL",
          },
          "dashboard.notificationCenter.list": { items: [], unreadCount: 0 },
        }[name] ?? [];
      out.push({ result: { data: { json: data } } });
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(out),
    });
  });
  await page.goto("http://localhost:5173/service-catalog");
  const consent = page.getByRole("button", {
    name: "Somente essenciais",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole("button", { name: "Novo serviço", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Novo serviço", exact: true }),
    name = `Visita de auditoria ${width} ${Date.now()}`,
    code = `AUD-${width}-${Date.now()}`;
  await modal.getByLabel("Código", { exact: true }).fill(code);
  await modal.getByLabel("Nome do serviço", { exact: true }).fill(name);
  await modal
    .getByLabel("Descrição", { exact: true })
    .fill("Avaliação do equipamento e orientações de manutenção.");
  await modal
    .getByLabel("Duração de referência (minutos)", { exact: true })
    .fill("60");
  const save = modal.getByRole("button", {
    name: "Salvar serviço",
    exact: true,
  });
  await save.evaluate((node) => {
    node.click();
    node.click();
  });
  await modal
    .getByText("Resposta perdida após salvar no catálogo", { exact: true })
    .waitFor();
  assert.equal(writes.filter((x) => x.operation === "create").length, 1);
  await save.click();
  await modal.waitFor({ state: "hidden" });
  assert.equal(writes[0].input.entryKey, writes[1].input.entryKey);
  const article = page.getByRole("article", { name, exact: true });
  await article.waitFor();
  await article.getByText("Sob consulta", { exact: true }).waitFor();
  await article
    .getByRole("button", { name: "Ver histórico", exact: true })
    .click();
  await article
    .getByText("Cadastro inicial", { exact: false })
    .first()
    .waitFor();
  await article
    .getByRole("button", { name: "Editar serviço", exact: true })
    .click();
  const edit = page.getByRole("dialog", {
    name: "Editar serviço",
    exact: true,
  });
  await edit
    .getByLabel("Preço de referência (BRL)", { exact: true })
    .fill("250,00");
  await edit
    .getByLabel("Motivo da alteração", { exact: true })
    .fill("Preço atualizado após revisão comercial do serviço.");
  await edit
    .getByRole("button", { name: "Salvar serviço", exact: true })
    .click();
  await edit
    .getByText("Resposta perdida após salvar no catálogo", { exact: true })
    .waitFor();
  assert.equal(
    await edit
      .getByLabel("Preço de referência (BRL)", { exact: true })
      .inputValue(),
    "250,00",
  );
  await edit
    .getByRole("button", { name: "Salvar serviço", exact: true })
    .click();
  await edit.waitFor({ state: "hidden" });
  const edits = writes.filter((x) => x.operation === "edit");
  assert.equal(edits.length, 2);
  assert.equal(edits[0].input.expectedVersion, edits[1].input.expectedVersion);
  await article
    .getByText(/250,00/)
    .first()
    .waitFor();
  await article
    .getByRole("button", { name: "Editar serviço", exact: true })
    .click();
  await edit.getByLabel("Serviço ativo", { exact: true }).uncheck();
  await edit
    .getByLabel("Motivo da alteração", { exact: true })
    .fill("Serviço arquivado por revisão do portfólio.");
  await edit
    .getByRole("button", { name: "Salvar serviço", exact: true })
    .click();
  await edit.waitFor({ state: "hidden" });
  await article.waitFor({ state: "hidden" });
  await page
    .getByRole("combobox", { name: "Situação dos serviços", exact: true })
    .click();
  await page.getByRole("option", { name: "Arquivados", exact: true }).click();
  await article.waitFor();
  await article
    .getByRole("button", { name: "Editar serviço", exact: true })
    .click();
  await edit
    .getByLabel("Nome do serviço", { exact: true })
    .fill("Rascunho não salvo");
  await edit.getByRole("button", { name: "Cancelar", exact: true }).click();
  const discard = page.getByRole("alertdialog");
  await discard.waitFor();
  await discard
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  await edit.waitFor({ state: "hidden" });
  await article
    .getByRole("button", { name: "Editar serviço", exact: true })
    .click();
  await edit.getByLabel("Serviço ativo", { exact: true }).check();
  await edit.getByLabel("Preço de referência (BRL)", { exact: true }).fill("0");
  await edit
    .getByLabel("Motivo da alteração", { exact: true })
    .fill("Reativado com preço de referência zero para avaliação.");
  await edit
    .getByRole("button", { name: "Salvar serviço", exact: true })
    .click();
  await edit.waitFor({ state: "hidden" });
  await article.waitFor({ state: "hidden" });
  await page
    .getByRole("combobox", { name: "Situação dos serviços", exact: true })
    .click();
  await page.getByRole("option", { name: "Ativos", exact: true }).click();
  await article.waitFor();
  await page
    .getByRole("textbox", { name: "Buscar por nome ou código", exact: true })
    .fill(code);
  await page
    .getByRole("form", { name: "Buscar serviços", exact: true })
    .getByRole("button", { name: "Buscar", exact: true })
    .click();
  await page.getByText("1 serviço(s) no resultado", { exact: true }).waitFor();
  const showHistory = article.getByRole("button", {
    name: "Ver histórico",
    exact: true,
  });
  if (await showHistory.count()) await showHistory.click();
  await article.getByText("Revisão 3", { exact: false }).waitFor();
  await article
    .getByRole("button", { name: "Fechar histórico", exact: true })
    .click();
  await article.scrollIntoViewIfNeeded();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  fs.mkdirSync("/workspace/attachments", { recursive: true });
  await page.screenshot({
    path: `/workspace/attachments/service-catalog-${width}.png`,
  });
  for (const next of ["STAFF", "VIEWER"]) {
    role = next;
    await page.reload();
    await page
      .getByRole("heading", { name: "Catálogo de serviços", exact: true })
      .waitFor();
    await article.waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Novo serviço", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await article
        .getByRole("button", { name: "Editar serviço", exact: true })
        .count(),
      0,
    );
    await article
      .getByRole("button", { name: "Ver histórico", exact: true })
      .click();
    await article.getByText("Revisão 3", { exact: false }).waitFor();
  }
  assert.equal(errors.length, 0, errors.join("\n"));
  await browser.close();
  console.log(
    `PASS ${width}: create/edit lost-response retry, zero/on-request, archive/reactivate, discard, history, roles, viewport`,
  );
})().catch(async (e) => {
  console.error(e);
  if (auditPage) {
    console.error(await auditPage.locator("body").innerText());
    await auditPage.screenshot({
      path: "/workspace/attachments/catalog-failure.png",
    });
  }
  process.exit(1);
});
