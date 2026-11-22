import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerConsentRoutes } from "./consent";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerNotificationStreamRoute } from "./notificationStream";
import { upstreamErrorDetails } from "./nexoClient";
import { clientIpObservationMiddleware } from "./clientIp";
import { internalAuthSigner, stripClientInternalHeaders } from "./internalAuth";

/** Procedures whose responses (data or errors) must never be stored by any cache. */
export const NO_STORE_PROCEDURES: ReadonlySet<string> = new Set(["system.clientIpDiagnostic"]);

/**
 * Cache-Control for a tRPC response: "private, no-store" when the call (or any call of a batch)
 * targets a no-store procedure, or when the paths could not be parsed. Other endpoints keep
 * their current behaviour.
 */
export function cacheControlHeaderFor(paths: readonly string[] | undefined): Record<string, string> | undefined {
  if (paths === undefined || paths.some((path) => NO_STORE_PROCEDURES.has(path))) return { "Cache-Control": "private, no-store" };
  return undefined;
}

/** Retry-After for the BFF response: the longest sanitized wait among the failed calls. */
export function retryAfterHeaderFor(errors: readonly unknown[]): Record<string, string> | undefined {
  const waits = errors
    .map((error) => upstreamErrorDetails(error).retryAfterSeconds)
    .filter((seconds): seconds is number => typeof seconds === "number");
  return waits.length ? { "Retry-After": String(Math.max(...waits)) } : undefined;
}

/**
 * Builds the BFF Express app with every API route it serves, without the frontend
 * (Vite in development, static assets otherwise) and without listening on a port.
 * Kept separate from `index.ts` so the exposed route surface can be tested over HTTP.
 */
export function createBffApp(): Express {
  const app = express();
  // C7.2d: validate the signing configuration at boot (invalid values fail loudly, never silently).
  internalAuthSigner();

  // C7.2c: count the shape of the forwarding chain (observation only, nothing is trusted).
  app.use(clientIpObservationMiddleware());
  // C7.2d: client-supplied x-nexo-* headers never enter the BFF (outgoing calls drop them too).
  app.use(stripClientInternalHeaders);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);
  registerConsentRoutes(app);
  registerNotificationStreamRoute(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      responseMeta: ({ errors, paths }) => {
        const headers = { ...retryAfterHeaderFor(errors), ...cacheControlHeaderFor(paths) };
        return Object.keys(headers).length ? { headers } : {};
      },
    })
  );

  return app;
}
