import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

const ROOT_MARKUP = '<div id="root"></div>';
const ENTRY_MARKUP = 'src="/src/main.tsx"';

function assertHtmlShell(template: string, source: string) {
  if (!template.includes(ROOT_MARKUP)) {
    throw new Error(`[web] HTML shell inválido (${source}): #root não encontrado.`);
  }

  if (!template.includes(ENTRY_MARKUP)) {
    throw new Error(
      `[web] HTML shell inválido (${source}): script de entrada /src/main.tsx não encontrado.`
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

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    console.log("[web] serving_app_shell", { url, mode: "vite" });

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      assertHtmlShell(template, clientTemplate);
      console.log("[web] html_template_loaded", { template: clientTemplate });
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
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
      assertHtmlShell(template, shellPath);
      console.log("[web] html_template_loaded", { template: shellPath });
      res.sendFile(shellPath);
    } catch (error) {
      next(error);
    }
  });
}
