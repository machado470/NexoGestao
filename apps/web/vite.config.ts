import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const plugins = [react(), tailwindcss(), jsxLocPlugin()];

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
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
