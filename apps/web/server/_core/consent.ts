import type { Express } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { logger } from "./logger";

const consentPayloadSchema = z.object({
  marketing: z.boolean(),
  analytics: z.boolean(),
  cookies: z.literal(true),
});

const CONSENT_COOKIE_NAME = "nexo_lgpd_consent";
const CONSENT_SCHEMA_VERSION = 1;
const CONSENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function getClientIp(forwardedForHeader: unknown, socketAddress?: string) {
  if (typeof forwardedForHeader === "string" && forwardedForHeader.trim()) {
    return forwardedForHeader.split(",")[0]?.trim() ?? socketAddress ?? "unknown";
  }

  if (Array.isArray(forwardedForHeader) && forwardedForHeader.length > 0) {
    return forwardedForHeader[0] ?? socketAddress ?? "unknown";
  }

  return socketAddress ?? "unknown";
}

export function registerConsentRoutes(app?: Express) {
  if (!app) return;

  app.post("/api/consent", (req, res) => {
    const parsedPayload = consentPayloadSchema.safeParse(req.body);

    if (!parsedPayload.success) {
      logger.security.warn("Invalid consent payload", {
        issues: parsedPayload.error.issues,
      });

      return res.status(400).json({
        ok: false,
        error: "Payload de consentimento inválido.",
      });
    }

    const consentEventId = randomUUID();
    const consentAt = new Date().toISOString();
    const auditPayload = {
      id: consentEventId,
      version: CONSENT_SCHEMA_VERSION,
      consentAt,
      preferences: parsedPayload.data,
      userAgent: req.get("user-agent") ?? "unknown",
      ip: getClientIp(req.headers["x-forwarded-for"], req.socket.remoteAddress),
    };

    res.cookie(CONSENT_COOKIE_NAME, encodeURIComponent(JSON.stringify(auditPayload)), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CONSENT_COOKIE_MAX_AGE_SECONDS * 1000,
    });

    logger.audit.info("LGPD consentimento registrado", {
      consentEventId,
      consentAt,
      preferences: parsedPayload.data,
      ip: auditPayload.ip,
    });

    return res.status(200).json({
      ok: true,
      consentId: consentEventId,
      consentAt,
    });
  });
}
