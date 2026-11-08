import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

import { loadClientHtml, assertHtmlShell, logHtmlDelivery } from "./htmlShell";
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

  async function buildHtmlResponse(url: string, host: string | undefined) {
    const { html, source } = await loadClientHtml(url);
    const transformed = await vite.transformIndexHtml(url, html);
    const finalSource = `${source} + vite.transformIndexHtml`;
    assertHtmlShell(transformed, finalSource, "vite");
    logHtmlDelivery(url, transformed, finalSource, host);
    return {
      html: transformed,
      source: finalSource,
      contentLength: Buffer.byteLength(transformed, "utf-8"),
    };
  }

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
      const { html, source, contentLength } = await buildHtmlResponse(req.originalUrl, req.headers.host);
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).send(html);
      console.log("[HTML_DELIVERY] sent", {
        host: req.headers.host ?? "(unknown)",
        path: req.originalUrl,
        status: 200,
        contentType: "text/html; charset=utf-8",
        contentLength,
        source,
      });
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });

  app.use(vite.middlewares);

  app.get("*", async (req, res, next) => {
    try {
      const { html, source, contentLength } = await buildHtmlResponse(req.originalUrl, req.headers.host);
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).send(html);
      console.log("[HTML_DELIVERY] sent", {
        host: req.headers.host ?? "(unknown)",
        path: req.originalUrl,
        status: 200,
        contentType: "text/html; charset=utf-8",
        contentLength,
        source,
      });
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });
}

export { serveStatic } from "./static";
