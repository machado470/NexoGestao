import type { Express, Request, Response } from "express";

const NEXO_API_URL = (process.env.NEXO_API_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

function readSafeRedirect(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const value = raw.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.startsWith("/login")) return null;
  if (value.startsWith("/register")) return null;
  if (value.startsWith("/forgot-password")) return null;
  if (value.startsWith("/reset-password")) return null;

  return value;
}

function encodeState(payload: Record<string, string>) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function buildGoogleAuthUrl(req: Request) {
  const url = new URL(`${NEXO_API_URL}/auth/google`);
  const safeRedirect = readSafeRedirect(req.query?.redirect);

  if (safeRedirect) {
    url.searchParams.set("state", encodeState({ redirect: safeRedirect }));
  }

  return url.toString();
}

function redirectToApiGoogleCallback(req: Request, res: Response) {
  const url = new URL(`${NEXO_API_URL}/auth/google/callback`);

  const query = req.query ?? {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") {
      url.searchParams.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          url.searchParams.append(key, item);
        }
      }
    }
  }

  return res.redirect(url.toString());
}

export function registerOAuthRoutes(app?: Express) {
  if (!app) return;

  app.get("/api/oauth/google/login", (req, res) => {
    return res.redirect(buildGoogleAuthUrl(req));
  });

  app.get("/api/oauth/google/callback", (req, res) => {
    return redirectToApiGoogleCallback(req, res);
  });

  app.get("/api/oauth/google/status", async (_req, res) => {
    try {
      const upstream = await fetch(`${NEXO_API_URL}/auth/google/status`, {
        method: "GET",
        headers: { "content-type": "application/json" },
      });

      const payload = await upstream.json().catch(() => null);

      if (!upstream.ok) {
        return res.status(200).json({
          configured: false,
          status: "missing",
          message: "Google OAuth indisponível no backend.",
        });
      }

      return res.status(200).json(payload ?? { configured: false, status: "missing" });
    } catch {
      return res.status(200).json({
        configured: false,
        status: "missing",
        message: "Não foi possível validar status do Google OAuth.",
      });
    }
  });
}

export function initOAuth() {}
