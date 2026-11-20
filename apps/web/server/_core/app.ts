import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerConsentRoutes } from "./consent";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerNotificationStreamRoute } from "./notificationStream";
import { upstreamErrorDetails } from "./nexoClient";

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
      responseMeta: ({ errors }) => {
        const headers = retryAfterHeaderFor(errors);
        return headers ? { headers } : {};
      },
    })
  );

  return app;
}
