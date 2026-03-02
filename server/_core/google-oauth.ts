import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const GOOGLE_OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || "/api/oauth/google/callback";

/**
 * Registra rotas de Google OAuth
 */
export function registerGoogleOAuthRoutes(app: Express) {
  /**
   * Inicia fluxo de login com Google
   * GET /api/oauth/google/login
   */
  app.get("/api/oauth/google/login", (req: Request, res: Response) => {
    if (!GOOGLE_OAUTH_CLIENT_ID) {
      return res.status(500).json({ error: "Google OAuth não configurado" });
    }

    const redirectUri = `${req.protocol}://${req.get("host")}/api/oauth/google/callback`;
    const state = Buffer.from(JSON.stringify({ redirectUri })).toString("base64");
    const scope = "openid profile email";

    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", GOOGLE_OAUTH_CLIENT_ID);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", scope);
    googleAuthUrl.searchParams.set("state", state);
    googleAuthUrl.searchParams.set("access_type", "offline");
    googleAuthUrl.searchParams.set("prompt", "consent");

    res.redirect(googleAuthUrl.toString());
  });

  /**
   * Callback do Google OAuth
   * GET /api/oauth/google/callback
   */
  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!code) {
      return res.status(400).json({ error: "Authorization code missing" });
    }

    if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
      return res.status(500).json({ error: "Google OAuth não configurado" });
    }

    try {
      const redirectUri = `${req.protocol}://${req.get("host")}/api/oauth/google/callback`;

      // Trocar código por token
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_OAUTH_CLIENT_ID,
          client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        console.error("[Google OAuth] Token exchange failed", error);
        return res.status(400).json({ error: "Token exchange failed" });
      }

      const tokens = (await tokenResponse.json()) as {
        access_token: string;
        id_token: string;
      };

      // Obter informações do usuário
      const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoResponse.ok) {
        return res.status(400).json({ error: "Failed to fetch user info" });
      }

      const userInfo = (await userInfoResponse.json()) as {
        sub: string;
        name?: string;
        email?: string;
        picture?: string;
      };

      if (!userInfo.sub) {
        return res.status(400).json({ error: "User ID missing from Google" });
      }

      // Criar ou atualizar usuário
      const googleOpenId = `google_${userInfo.sub}`;
      await db.upsertUser({
        openId: googleOpenId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      // Criar session token usando Manus SDK
      const sessionToken = await sdk.createSessionToken(googleOpenId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirecionar para home
      res.redirect(302, "/");
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error);
      res.status(500).json({ error: "Google OAuth callback failed" });
    }
  });
}
