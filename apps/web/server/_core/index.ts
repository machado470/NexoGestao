import "./load-env";
import express from "express";
import { createServer } from "http";
import type { AddressInfo } from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerConsentRoutes } from "./consent";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { subscribeToNotificationCenterEvents } from "./notificationCenterEvents";
import { registerExecutionLogRoutes } from "./executionLog";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);
  registerConsentRoutes(app);
  registerExecutionLogRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    console.log("[BFF] NODE_ENV=development, habilitando Vite middleware");
    await setupVite(app, server);
  } else {
    console.log("[BFF] NODE_ENV!=development, servindo frontend estático");
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3010");

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `[web] Falha ao iniciar: porta ${port} já está em uso. ` +
          `[web] Sugestão: tente PORT=${port + 1} ou finalize o processo atual.`
      );
    }
    throw error;
  });

  server.listen(port, () => {
    const address = server.address() as AddressInfo | null;
    const finalPort = address?.port ?? port;
    console.log(`[web] Server running on http://localhost:${finalPort}/`);
    console.log(`[web] PORT=${finalPort}`);
    console.log(`[web] NEXO_API_URL=${process.env.NEXO_API_URL || "http://localhost:3000"}`);
  });
}

startServer().catch(console.error);
