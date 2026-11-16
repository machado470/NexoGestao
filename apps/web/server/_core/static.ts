import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { MIN_HTML_LENGTH_BYTES, HTML_FALLBACK, assertHtmlShell, logHtmlDelivery } from "./htmlShell";
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
