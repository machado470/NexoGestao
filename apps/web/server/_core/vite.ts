import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

const ROOT_MARKUP = '<div id="root"></div>';

function assertHtmlShell(template: string, source: string, mode: "vite" | "static") {
  if (!template.includes(ROOT_MARKUP)) {
    throw new Error(`[web] HTML shell inválido (${source}): #root não encontrado.`);
  }

  const hasModuleScript = /<script[^>]*type="module"[^>]*src="[^"]+"[^>]*>/.test(template);
  if (!hasModuleScript) {
    throw new Error(
      `[web] HTML shell inválido (${source}): script de entrada não encontrado em modo ${mode}.`
    );
  }
}

export async function setupVite(app: Express, server: Server) {
  const configuredPlugins = Array.isArray(viteConfig.plugins)
    ? viteConfig.plugins.flatMap((plugin) =>
        Array.isArray(plugin)
          ? plugin.map((inner) => (inner && typeof inner === "object" && "name" in inner ? inner.name : String(inner)))
          : [plugin && typeof plugin === "object" && "name" in plugin ? plugin.name : String(plugin)]
      )
    : [];

  console.log("[web] setupVite env", {
    NODE_ENV: process.env.NODE_ENV ?? "(undefined)",
    MANUS_RUNTIME: process.env.MANUS_RUNTIME ?? "(undefined)",
    MANUS_DEBUG_COLLECTOR: process.env.MANUS_DEBUG_COLLECTOR ?? "(undefined)",
    configuredPlugins,
  });

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true as const,
    },
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    try {
      const clientTemplate = path.resolve(import.meta.dirname, "../..", "client", "index.html");
      const template = await fs.promises.readFile(clientTemplate, "utf-8");

      assertHtmlShell(template, clientTemplate, "vite");
      console.log("[web] html_template_loaded", {
        mode: "vite",
        template: clientTemplate,
        htmlSizeBytes: Buffer.byteLength(template, "utf-8"),
        url: req.originalUrl,
      });

      const page = await vite.transformIndexHtml(req.originalUrl, template);
      assertHtmlShell(page, `${clientTemplate} (transformIndexHtml)`, "vite");

      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
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

    try {
      const template = await fs.promises.readFile(shellPath, "utf-8");
      assertHtmlShell(template, shellPath, "static");
      console.log("[web] html_template_loaded", {
        mode: "static",
        template: shellPath,
        htmlSizeBytes: Buffer.byteLength(template, "utf-8"),
        url: req.originalUrl,
      });
      res.sendFile(shellPath);
    } catch (error) {
      next(error);
    }
  });
}
