import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

const ROOT_MARKUP = '<div id="root"></div>';

function assertHtmlShell(
  template: string,
  source: string,
  mode: "vite" | "static"
) {
  if (!template.includes("<html") || !template.includes("</html>")) {
    throw new Error(`[web] HTML shell inválido (${source}): tag <html> ausente.`);
  }

  if (!template.includes("<head") || !template.includes("</head>")) {
    throw new Error(`[web] HTML shell inválido (${source}): tag <head> ausente.`);
  }

  if (!template.includes("<body") || !template.includes("</body>")) {
    throw new Error(`[web] HTML shell inválido (${source}): tag <body> ausente.`);
  }

  if (!template.includes(ROOT_MARKUP)) {
    throw new Error(`[web] HTML shell inválido (${source}): #root não encontrado.`);
  }

  const hasModuleScript = /<script[^>]*type=\"module\"[^>]*src=\"[^\"]+\"[^>]*>/.test(template);
  const hasMainEntrypoint =
    /<script[^>]*type=\"module\"[^>]*src=\"\/src\/main\.tsx(?:\?[^\"]*)?\"[^>]*>/.test(
      template
    );

  if (!hasModuleScript) {
    throw new Error(`[web] HTML shell inválido (${source}): script de entrada não encontrado em modo ${mode}.`);
  }

  if (mode === "vite" && !hasMainEntrypoint) {
    throw new Error(
      `[web] HTML shell inválido (${source}): entrypoint esperado /src/main.tsx não encontrado.`
    );
  }
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  console.log("[BFF] Vite dev server criado em middleware mode");

  app.use((req, _res, next) => {
    console.log("[BFF] intercept", req.method, req.originalUrl);
    next();
  });

  app.use("/src/main.tsx", (req, _res, next) => {
    console.log("[BFF] calling Vite for entrypoint", req.originalUrl);
    next();
  });

  app.use(vite.middlewares);
  console.log("[BFF] Vite middlewares acoplados ao Express");

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    console.log("[BFF] serving HTML for", url);

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      assertHtmlShell(template, clientTemplate, "vite");
      console.log("[web] html_template_loaded", {
        template: clientTemplate,
        htmlSizeBytes: Buffer.byteLength(template, "utf-8"),
      });
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      console.log("[BFF] calling Vite transformIndexHtml for", url);
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      console.error("[BFF] vite transform falhou, enviando fallback hard", e);
      res
        .status(200)
        .set({ "Content-Type": "text/html" })
        .end(`<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NexoGestão - fallback</title>
  </head>
  <body>
    <div id="root"></div>
    <script>document.body.innerHTML = "JS não carregado";</script>
  </body>
</html>`);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", async (req, res, next) => {
    const shellPath = path.resolve(distPath, "index.html");
    console.log("[web] serving_app_shell", { url: req.originalUrl, mode: "static" });

    try {
      const template = await fs.promises.readFile(shellPath, "utf-8");
      assertHtmlShell(template, shellPath, "static");
      console.log("[web] html_template_loaded", {
        template: shellPath,
        htmlSizeBytes: Buffer.byteLength(template, "utf-8"),
      });
      res.sendFile(shellPath);
    } catch (error) {
      next(error);
    }
  });
}
