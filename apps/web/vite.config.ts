import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {}
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  const lines = entries.map((entry) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }

      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

const plugins = [
  react(),
  tailwindcss(),
  jsxLocPlugin(),
];

const manusRuntimeEnabled = process.env.MANUS_RUNTIME === "1";
const manusDebugCollectorEnabled = process.env.MANUS_DEBUG_COLLECTOR === "1";

if (manusDebugCollectorEnabled) {
  plugins.push(vitePluginManusDebugCollector());
}

if (manusRuntimeEnabled) {
  plugins.unshift(vitePluginManusRuntime());
}

console.info("[VITE_BOOT]", {
  manusRuntimeEnabled,
  manusDebugCollectorEnabled,
  MANUS_RUNTIME: process.env.MANUS_RUNTIME ?? "(undefined)",
  MANUS_DEBUG_COLLECTOR: process.env.MANUS_DEBUG_COLLECTOR ?? "(undefined)",
  pluginNames: plugins.flatMap((plugin) =>
    Array.isArray(plugin)
      ? plugin.map((inner) => inner?.name ?? "(unnamed)")
      : [plugin?.name ?? "(unnamed)"]
  ),
});

function getVendorChunk(id: string) {
  if (!id.includes("node_modules")) return;

  if (
    id.includes("@trpc") ||
    id.includes("@tanstack/react-query") ||
    id.includes("@tanstack/query-core") ||
    id.includes("superjson")
  ) {
    return "vendor-data";
  }

  if (
    id.includes("/recharts/") ||
    id.includes("/victory-") ||
    id.includes("/d3-")
  ) {
    return "vendor-charts";
  }

  if (
    id.includes("@fullcalendar/")
  ) {
    return "vendor-calendar";
  }

  if (
    id.includes("framer-motion")
  ) {
    return "vendor-motion";
  }

  if (
    id.includes("streamdown") ||
    id.includes("shepherd")
  ) {
    return "vendor-extras";
  }

  if (
    id.includes("lucide-react") ||
    id.includes("@radix-ui") ||
    id.includes("embla-carousel") ||
    id.includes("cmdk") ||
    id.includes("vaul") ||
    id.includes("input-otp") ||
    id.includes("react-day-picker") ||
    id.includes("class-variance-authority") ||
    id.includes("clsx") ||
    id.includes("tailwind-merge") ||
    id.includes("react-resizable-panels")
  ) {
    return "vendor-ui";
  }

  if (
    id.includes("react-hook-form") ||
    id.includes("@hookform/resolvers") ||
    id.includes("/zod/") ||
    id.includes("/date-fns/") ||
    id.includes("/sonner/") ||
    id.includes("/nanoid/")
  ) {
    return "vendor-utils";
  }

  if (
    id.includes("@aws-sdk/") ||
    id.includes("@sentry/") ||
    id.includes("axios")
  ) {
    return "vendor-integrations";
  }

  if (
    id.includes("wouter") ||
    id.includes("zustand") ||
    id.includes("next-themes") ||
    id.includes("jose")
  ) {
    return "vendor-core";
  }

  return "vendor-misc";
}

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),

  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          return getVendorChunk(id);
        },
      },
    },
  },

  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
