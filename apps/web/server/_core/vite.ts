import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

const ROOT_MARKUP = '<div id="root"></div>';
const MIN_HTML_LENGTH_BYTES = 400;
const CLIENT_INDEX_PATH = path.resolve(import.meta.dirname, "../..", "client", "index.html");
const HTML_FALLBACK = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NexoGestão - Fallback</title>
  </head>
  <body style="font-family: system-ui, sans-serif; margin: 0; background: #f3f4f6;">
    <div id="html-immediate-marker" style="min-height:100vh;display:grid;place-items:center;padding:16px;">
      <div style="background:#fff;border:1px solid #d1d5db;border-radius:10px;padding:16px;max-width:860px;width:min(860px,100%);">
        <h1 style="margin:0 0 8px;">HTML carregado (fallback)</h1>
        <p style="margin:0;color:#4b5563;">O shell principal não foi carregado corretamente. Este fallback garante que o HTML nunca fique em branco.</p>
      </div>
    </div>
    <div id="root"></div>
  </body>
</html>`;

function logHtmlDelivery(url: string, html: string, source: string, host: string | undefined) {
  const htmlSizeBytes = Buffer.byteLength(html, "utf-8");
  const snippet = html.slice(0, 200).replace(/\s+/g, " ");
  console.log("[web] serving index.html", {
    url,
    source,
    host: host ?? "(unknown)",
    htmlSizeBytes,
    first200Chars: snippet,
  });
}

async function loadClientHtml(url: string): Promise<{ html: string; source: string }> {
  const source = CLIENT_INDEX_PATH;
  const html = await fs.promises.readFile(source, "utf-8");

  if (Buffer.byteLength(html, "utf-8") < MIN_HTML_LENGTH_BYTES) {
    console.error("[web] html_too_small", {
      url,
      source,
      htmlSizeBytes: Buffer.byteLength(html, "utf-8"),
      minExpectedBytes: MIN_HTML_LENGTH_BYTES,
    });
    return { html: HTML_FALLBACK, source: `${source} (fallback)` };
  }

  return { html, source };
}

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

  console.log("[web] setupVite", {
    NODE_ENV: process.env.NODE_ENV ?? "(undefined)",
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

  app.use((req, res, next) => {
    const startedAt = Date.now();
    const url = req.originalUrl || req.url || "";
    const isTrackedAsset =
      url === "/" ||
      url.includes("index.html") ||
      url.includes("/src/main.tsx") ||
      /\.([cm]?js|mjs|ts|tsx)$/.test(url);

    if (!isTrackedAsset) {
      next();
      return;
    }

    console.log("[VITE_REQ] start", { method: req.method, url });
    const pendingTimer = setTimeout(() => {
      console.warn("[VITE_REQ] pending", { method: req.method, url, pendingMs: Date.now() - startedAt });
    }, 10_000);

    res.on("finish", () => {
      clearTimeout(pendingTimer);
      const payload = {
        method: req.method,
        url,
        host: req.headers.host ?? "(unknown)",
        status: res.statusCode,
        contentType: res.getHeader("content-type") ?? "(unset)",
        contentLength: res.getHeader("content-length") ?? "(unset)",
        durationMs: Date.now() - startedAt,
      };
      if (res.statusCode >= 500) {
        console.error("[VITE_REQ] finish", payload);
      } else if (res.statusCode >= 400) {
        console.warn("[VITE_REQ] finish", payload);
      } else {
        console.log("[VITE_REQ] finish", payload);
      }
    });

    next();
  });

  app.get("/", async (req, res, next) => {
    try {
      const { html, source } = await loadClientHtml(req.originalUrl);
      assertHtmlShell(html, source, "vite");
      logHtmlDelivery(req.originalUrl, html, source, req.headers.host);
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).send(html);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });

  app.use(vite.middlewares);

  app.get("*", async (req, res, next) => {
    try {
      const { html, source } = await loadClientHtml(req.originalUrl);
      assertHtmlShell(html, source, "vite");
      logHtmlDelivery(req.originalUrl, html, source, req.headers.host);
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).send(html);
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

  app.use((req, res, next) => {
    const url = req.originalUrl || req.url || "";
    const isTrackedAsset =
      url === "/" ||
      url.includes("index.html") ||
      url.includes("/src/main.tsx") ||
      /\.([cm]?js|mjs|ts|tsx)$/.test(url);
    if (!isTrackedAsset) {
      next();
      return;
    }
    console.log("[STATIC_REQ] start", { method: req.method, url });
    res.on("finish", () => {
      const payload = {
        method: req.method,
        url,
        host: req.headers.host ?? "(unknown)",
        status: res.statusCode,
        contentType: res.getHeader("content-type") ?? "(unset)",
        contentLength: res.getHeader("content-length") ?? "(unset)",
      };
      if (res.statusCode >= 500) {
        console.error("[STATIC_REQ] finish", payload);
      } else if (res.statusCode >= 400) {
        console.warn("[STATIC_REQ] finish", payload);
      } else {
        console.log("[STATIC_REQ] finish", payload);
      }
    });
    next();
  });

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.get("*", async (req, res, next) => {
    const shellPath = path.resolve(distPath, "index.html");

    try {
      const template = await fs.promises.readFile(shellPath, "utf-8");
      const html =
        Buffer.byteLength(template, "utf-8") < MIN_HTML_LENGTH_BYTES
          ? HTML_FALLBACK
          : template;
      const source =
        Buffer.byteLength(template, "utf-8") < MIN_HTML_LENGTH_BYTES
          ? `${shellPath} (fallback)`
          : shellPath;
      assertHtmlShell(html, source, "static");
      logHtmlDelivery(req.originalUrl, html, source, req.headers.host);
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).send(html);
    } catch (error) {
      next(error);
    }
  });
}
