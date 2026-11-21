import type { Express } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { logger } from "./logger";
import { observeClientIpChain } from "./clientIp";

const consentPayloadSchema = z.object({
  marketing: z.boolean(),
  analytics: z.boolean(),
  cookies: z.literal(true),
});

const CONSENT_COOKIE_NAME = "nexo_lgpd_consent";
const CONSENT_SCHEMA_VERSION = 1;
const CONSENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

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
    // C7.2c: no IP is recorded unless its origin was verified through a trusted proxy chain.
    // With the production policy (NO_TRUST) nothing is verified, so the record keeps `ip: null`
    // and states why. The first X-Forwarded-For value (chosen by the client) is never used.
    const origin = observeClientIpChain(req);
    const ipVerified = origin.classification === "verified";
    const auditPayload = {
      id: consentEventId,
      version: CONSENT_SCHEMA_VERSION,
      consentAt,
      preferences: parsedPayload.data,
      userAgent: req.get("user-agent") ?? "unknown",
    };

    // The browser-side copy carries no IP address.
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
      ip: ipVerified ? origin.candidate : null,
      ipVerified,
      ipVerification: origin.classification,
    });

    return res.status(200).json({
      ok: true,
      consentId: consentEventId,
      consentAt,
    });
  });
}
