import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext, fetchNexoMe } from "./context";
import { subscribeToNotificationCenterEvents } from "./notificationCenterEvents";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.get("/api/notification-center/stream", async (req, res) => {
    const me = await fetchNexoMe(req);
    const orgId = me?.user?.orgId ?? me?.data?.user?.orgId;

    if (!orgId) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendEvent = (event: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    sendEvent({ type: "connected", timestamp: new Date().toISOString() });

    const unsubscribe = subscribeToNotificationCenterEvents(
      String(orgId),
      (event) => {
        sendEvent({
          type: event.type,
          notificationId: event.notificationId,
          timestamp: new Date().toISOString(),
        });
      }
    );

    const heartbeat = setInterval(() => {
      res.write(": ping\n\n");
    }, 25_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3001");

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`NEXO_API_URL=${process.env.NEXO_API_URL || "http://127.0.0.1:3000"}`);
  });
}

startServer().catch(console.error);
