import type { Express, Request, Response } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import cookie from "cookie";
import { getSessionCookieOptions } from "./cookies";

const NEXO_API_URL = (process.env.NEXO_API_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const GOOGLE_STATE_COOKIE = "oauth_google_state";
const NEXO_TOKEN_COOKIE = "nexo_token";

const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
const GOOGLE_REDIRECT_URI = (process.env.GOOGLE_REDIRECT_URI ?? "").trim();
const GOOGLE_OAUTH_STATE_SECRET = (
  process.env.GOOGLE_OAUTH_STATE_SECRET ||
  process.env.JWT_SECRET ||
  process.env.GOOGLE_CLIENT_SECRET ||
  ""
).trim();

type OAuthStatePayload = {
  n: string;
  t: number;
  r?: string;
};

function isGoogleConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

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

function signState(payloadBase64: string) {
  return createHmac("sha256", GOOGLE_OAUTH_STATE_SECRET)
    .update(payloadBase64)
    .digest("base64url");
}

function encodeState(payload: OAuthStatePayload) {
  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signState(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

function decodeState(state: string | null | undefined): OAuthStatePayload | null {
  if (!state || typeof state !== "string") return null;
  const [payloadBase64, providedSignature] = state.split(".");
  if (!payloadBase64 || !providedSignature) return null;

  const expectedSignature = signState(payloadBase64);
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(providedSignature);

  if (expectedBuffer.length !== providedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf8")
    ) as OAuthStatePayload;

    if (!decoded || typeof decoded !== "object") return null;
    if (typeof decoded.n !== "string" || decoded.n.length < 8) return null;
    if (typeof decoded.t !== "number" || !Number.isFinite(decoded.t)) return null;

    const ageMs = Date.now() - decoded.t;
    if (ageMs < 0 || ageMs > 10 * 60 * 1000) return null;

    const safeRedirect = readSafeRedirect(decoded.r);
    return {
      n: decoded.n,
      t: decoded.t,
      ...(safeRedirect ? { r: safeRedirect } : {}),
    };
  } catch {
    return null;
  }
}


function readCookie(req: Request, name: string): string {
  const directCookie = req.cookies?.[name];
  if (typeof directCookie === "string" && directCookie.trim()) {
    return directCookie.trim();
  }

  const raw = req.headers?.cookie;
  if (typeof raw !== "string" || !raw.trim()) return "";

  const parsed = cookie.parse(raw);
  const value = parsed?.[name];
  return typeof value === "string" ? value.trim() : "";
}

function clearGoogleStateCookie(req: Request, res: Response) {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(GOOGLE_STATE_COOKIE, {
    ...cookieOptions,
    maxAge: undefined,
  });
}

function setGoogleStateCookie(req: Request, res: Response, value: string) {
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(GOOGLE_STATE_COOKIE, value, {
    ...cookieOptions,
    maxAge: 10 * 60 * 1000,
  });
}

function setSessionCookie(req: Request, res: Response, token: string) {
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(NEXO_TOKEN_COOKIE, token, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function extractToken(result: any): string | null {
  return (
    result?.data?.data?.token ||
    result?.data?.token ||
    result?.token ||
    result?.accessToken ||
    result?.data?.accessToken ||
    null
  );
}

function redirectToLoginWithError(res: Response, errorCode: string) {
  const url = new URL("/login", "http://localhost");
  url.searchParams.set("error", errorCode);
  return res.redirect(`${url.pathname}${url.search}`);
}

function buildGoogleAuthUrl(req: Request, res: Response) {
  const safeRedirect = readSafeRedirect(req.query?.redirect);
  const payload: OAuthStatePayload = {
    n: randomBytes(16).toString("hex"),
    t: Date.now(),
    ...(safeRedirect ? { r: safeRedirect } : {}),
  };

  const encodedState = encodeState(payload);
  setGoogleStateCookie(req, res, encodedState);

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", encodedState);
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "select_account");

  return url.toString();
}

async function exchangeCodeForTokens(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const tokenPayload = await tokenRes.json().catch(() => null);

  if (!tokenRes.ok || !tokenPayload?.access_token) {
    throw new Error("google_token_exchange_failed");
  }

  return tokenPayload as {
    access_token: string;
    id_token?: string;
    expires_in?: number;
    token_type?: string;
  };
}

async function fetchGoogleUser(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.email) {
    throw new Error("google_userinfo_failed");
  }

  return payload as {
    sub?: string;
    email: string;
    email_verified?: boolean;
    given_name?: string;
    family_name?: string;
    picture?: string;
    name?: string;
  };
}

async function establishSessionInApi(googleUser: {
  sub?: string;
  email: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
}) {
  const upstream = await fetch(`${NEXO_API_URL}/auth/google/bff-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sub: googleUser.sub,
      email: googleUser.email,
      firstName: googleUser.given_name,
      lastName: googleUser.family_name,
      picture: googleUser.picture,
      emailVerified: googleUser.email_verified,
    }),
  });

  const payload = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    const message =
      payload?.message || payload?.error || "Não foi possível autenticar com Google.";
    throw new Error(String(message));
  }

  const token = extractToken(payload);
  if (!token) {
    throw new Error("google_session_token_missing");
  }

  return { token, payload };
}

async function handleGoogleCallback(req: Request, res: Response) {
  if (!isGoogleConfigured()) {
    return redirectToLoginWithError(res, "google_oauth_not_configured");
  }

  if (!GOOGLE_OAUTH_STATE_SECRET) {
    return redirectToLoginWithError(res, "google_oauth_state_secret_missing");
  }

  const code = typeof req.query?.code === "string" ? req.query.code.trim() : "";
  const state = typeof req.query?.state === "string" ? req.query.state.trim() : "";

  const decodedState = decodeState(state);
  const stateCookie = readCookie(req, GOOGLE_STATE_COOKIE);

  if (!code || !decodedState || !stateCookie || stateCookie !== state) {
    clearGoogleStateCookie(req, res);
    return redirectToLoginWithError(res, "google_oauth_invalid_state");
  }

  clearGoogleStateCookie(req, res);

  try {
    const tokenPayload = await exchangeCodeForTokens(code);
    const googleUser = await fetchGoogleUser(tokenPayload.access_token);

    if (googleUser.email_verified === false) {
      return redirectToLoginWithError(res, "google_email_not_verified");
    }

    const session = await establishSessionInApi(googleUser);
    setSessionCookie(req, res, session.token);

    const redirectTarget = decodedState.r || "/executive-dashboard";
    return res.redirect(redirectTarget);
  } catch {
    return redirectToLoginWithError(res, "google_oauth_callback_failed");
  }
}

function getGoogleStatusPayload() {
  const configured = isGoogleConfigured() && Boolean(GOOGLE_OAUTH_STATE_SECRET);
  return {
    configured,
    status: configured ? "configured" : "missing",
    missing: {
      clientId: !GOOGLE_CLIENT_ID,
      clientSecret: !GOOGLE_CLIENT_SECRET,
      redirectUri: !GOOGLE_REDIRECT_URI,
      stateSecret: !GOOGLE_OAUTH_STATE_SECRET,
    },
    message: configured
      ? "Google OAuth configurado."
      : "Google OAuth não configurado neste ambiente.",
  };
}

export function registerOAuthRoutes(app?: Express) {
  if (!app) return;

  app.get("/api/auth/google", (req, res) => {
    if (!isGoogleConfigured()) {
      return redirectToLoginWithError(res, "google_oauth_not_configured");
    }

    if (!GOOGLE_OAUTH_STATE_SECRET) {
      return redirectToLoginWithError(res, "google_oauth_state_secret_missing");
    }

    return res.redirect(buildGoogleAuthUrl(req, res));
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    return handleGoogleCallback(req, res);
  });

  app.get("/api/auth/google/status", (_req, res) => {
    return res.status(200).json(getGoogleStatusPayload());
  });

  // Compatibilidade com rotas legadas.
  app.get("/api/oauth/google/login", (req, res) => {
    return res.redirect(`/api/auth/google${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`);
  });

  app.get("/api/oauth/google/callback", (req, res) => {
    return res.redirect(`/api/auth/google/callback${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`);
  });

  app.get("/api/oauth/google/status", (_req, res) => {
    return res.status(200).json(getGoogleStatusPayload());
  });
}

export function initOAuth() {}
