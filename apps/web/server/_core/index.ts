import "./load-env";
import { createServer } from "http";
import type { AddressInfo } from "net";
import { getNexoApiResolutionMetadata } from "./nexoApiUrl";
import { serveStatic } from "./static";
import { createBffApp } from "./app";

async function startServer() {
  const app = createBffApp();
  const server = createServer(app);

  if (process.env.NODE_ENV === "development") {
    console.log("[BFF] NODE_ENV=development, habilitando Vite middleware");
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    console.log("[BFF] NODE_ENV!=development, servindo frontend estático");
    serveStatic(app);
  }

  const port = Number(process.env.WEB_PORT || process.env.PORT || "3010");

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `[web] Falha ao iniciar: porta ${port} já está em uso. ` +
          `[web] Sugestão: tente WEB_PORT=${port + 1} ou finalize o processo atual.`
      );
    }
    throw error;
  });

  server.listen(port, () => {
    const address = server.address() as AddressInfo | null;
    const finalPort = address?.port ?? port;
    console.log(`[web] Server running on http://localhost:${finalPort}/`);
    console.log(`[web] WEB_PORT=${finalPort}`);
    const nexoApi = getNexoApiResolutionMetadata();
    console.log(
      `[web] NEXO_API_URL resolved=${nexoApi.resolved} configured=${nexoApi.configured ?? "default"} ` +
        `fallback=${nexoApi.usedFallback} normalizedLocalhost=${nexoApi.normalizedLocalhost}`
    );
  });
}

startServer().catch(console.error);
