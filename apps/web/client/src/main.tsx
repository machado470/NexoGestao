import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import ErrorBoundary from "./components/ErrorBoundary";
import App from "./App";
import "./index.css";
import {
  ensureAuditState,
  markAuditError,
  pushAuditEvent,
  setAuditField,
} from "@/lib/renderAudit";
import { getQueryClient, getTrpcClient, TRPCProvider } from "@/lib/trpc";

function nowIso() {
  return new Date().toISOString();
}

console.info("[MAIN] file loaded", { at: nowIso() });

function getRenderAuditMode(): "bare-html" | "minimal" | "app" {
  const raw = new URLSearchParams(window.location.search)
    .get("renderAuditMode")
    ?.trim()
    .toLowerCase();

  if (raw === "bare-html" || raw === "minimal" || raw === "app") {
    return raw;
  }
  return "app";
}

function detectLargeFixedOverlays() {
  if (typeof window === "undefined") return [] as string[];
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return Array.from(document.body.querySelectorAll<HTMLElement>("*")).flatMap((node) => {
    const style = window.getComputedStyle(node);
    if (style.position !== "fixed") return [];
    const rect = node.getBoundingClientRect();
    const coversViewport = rect.width >= vw * 0.95 && rect.height >= vh * 0.95;
    if (!coversViewport) return [];

    return [
      `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${
        node.className ? `.${String(node.className).split(" ").join(".")}` : ""
      }`,
    ];
  });
}

function logCssDiagnostics(root: HTMLElement) {
  const htmlStyle = window.getComputedStyle(document.documentElement);
  const bodyStyle = window.getComputedStyle(document.body);
  const rootStyle = window.getComputedStyle(root);
  const overlays = detectLargeFixedOverlays();

  const snapshot = {
    timestamp: nowIso(),
    root: {
      width: root.clientWidth,
      height: root.clientHeight,
      display: rootStyle.display,
      visibility: rootStyle.visibility,
      opacity: rootStyle.opacity,
      position: rootStyle.position,
    },
    body: {
      width: document.body.clientWidth,
      height: document.body.clientHeight,
      display: bodyStyle.display,
      visibility: bodyStyle.visibility,
      opacity: bodyStyle.opacity,
      position: bodyStyle.position,
    },
    html: {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      display: htmlStyle.display,
      visibility: htmlStyle.visibility,
      opacity: htmlStyle.opacity,
      position: htmlStyle.position,
    },
    overlays,
  };

  console.info("[CSS] layout_snapshot", snapshot);
  pushAuditEvent("css", "layout_snapshot", snapshot);
}

function renderBootstrapError(errorLike: unknown, phase: string) {
  const error = errorLike instanceof Error ? errorLike : new Error(String(errorLike));
  markAuditError("bootstrap", error);
  setAuditField("phase", phase);
  console.error("[BOOT] fatal", { phase, message: error.message, stack: error.stack });

  document.body.innerHTML = `
    <div style="padding:20px;font-family:Inter,system-ui,sans-serif;background:#fff7ed;min-height:100vh;">
      <h1 style="margin:0 0 12px;color:#9a3412;">Erro crítico no bootstrap React</h1>
      <p style="margin:0 0 8px;"><strong>Fase:</strong> ${phase}</p>
      <pre style="white-space:pre-wrap;background:#111827;color:#f9fafb;padding:12px;border-radius:8px;">${error.stack ?? error.message}</pre>
    </div>
  `;
}

const audit = ensureAuditState();
setAuditField("phase", "main:start");
setAuditField("pathname", window.location.pathname);
setAuditField("readyState", document.readyState);
setAuditField("title", document.title);
pushAuditEvent("main", "start", {
  href: window.location.href,
  readyState: document.readyState,
  title: document.title,
});
console.info("[MAIN] started", {
  at: nowIso(),
  href: window.location.href,
  readyState: document.readyState,
});

window.addEventListener("error", (event) => {
  const error = event.error ?? new Error(event.message || "Unknown window error");
  markAuditError("window-error", error);
  setAuditField("phase", "window:error");
  pushAuditEvent("window", "error", {
    message: error.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
  console.error("[WINDOW_ERROR]", error);
});
window.onerror = (message, source, lineno, colno, error) => {
  const normalized = error instanceof Error ? error : new Error(String(message));
  markAuditError("window-onerror", normalized);
  setAuditField("phase", "window:onerror");
  pushAuditEvent("window", "onerror", {
    message: String(message),
    source: source ?? "(unknown)",
    lineno: lineno ?? -1,
    colno: colno ?? -1,
    stack: normalized.stack ?? normalized.message,
  });
  console.error("[WINDOW_ONERROR]", {
    message,
    source,
    lineno,
    colno,
    stack: normalized.stack,
  });
  return false;
};

window.addEventListener("unhandledrejection", (event) => {
  markAuditError("unhandled-promise", event.reason);
  setAuditField("phase", "window:unhandledrejection");
  pushAuditEvent("window", "unhandledrejection", {
    reason: String(event.reason),
  });
  console.error("[UNHANDLED_PROMISE]", event.reason);
});
window.onunhandledrejection = (event) => {
  markAuditError("window-onunhandledrejection", event.reason);
  setAuditField("phase", "window:onunhandledrejection");
  pushAuditEvent("window", "onunhandledrejection", {
    reason: String(event.reason),
  });
  console.error("[WINDOW_ONUNHANDLEDREJECTION]", event.reason);
};

const root = document.getElementById("root");
setAuditField("rootFound", Boolean(root));
if (!root) {
  renderBootstrapError(new Error("Root element #root not found"), "main:root-not-found");
  throw new Error("Root element #root not found");
}

const renderAuditMode = getRenderAuditMode();
audit.renderAuditMode = renderAuditMode;
setAuditField("phase", `main:mode:${renderAuditMode}`);
pushAuditEvent("main", "mode", { renderAuditMode });
console.info("[MAIN] mode", { renderAuditMode });

logCssDiagnostics(root);

if (renderAuditMode === "bare-html") {
  root.innerHTML = `
    <section style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#0f172a;color:#f8fafc;font-family:Inter,system-ui,sans-serif;">
      <div style="max-width:680px;width:100%;border:1px solid #334155;border-radius:14px;padding:20px;background:#111827;">
        <h1 style="margin:0 0 10px;">BARE HTML OK</h1>
        <p style="margin:0;color:#cbd5e1;">Modo renderAuditMode=bare-html ativo. O HTML chegou e o bootstrap React foi pulado intencionalmente.</p>
      </div>
    </section>
  `;
  setAuditField("phase", "main:bare-html-rendered");
  pushAuditEvent("main", "bare-html-rendered");
  console.info("[HTML] bare mode rendered");
} else {
  const queryClient = getQueryClient();
  const trpcClient = getTrpcClient();

  const appNode = renderAuditMode === "minimal"
    ? <div style={{ padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>MINIMAL REACT OK</div>
    : <App />;

  try {
    setAuditField("createRootStartedAt", nowIso());
    setAuditField("phase", "main:createRoot");
    console.info("[MAIN] before createRoot", { renderAuditMode });
    console.info("[BOOT] createRoot called", { renderAuditMode });
    const reactRoot = createRoot(root);
    console.info("[MAIN] after createRoot", { renderAuditMode });
    console.info("[MAIN] before render", { renderAuditMode });

    reactRoot.render(
      <QueryClientProvider client={queryClient}>
        {(() => {
          console.info("[BOOT] QueryClientProvider ativo");
          return (
            <TRPCProvider client={trpcClient} queryClient={queryClient}>
              <ErrorBoundary routeContext="root">
                {appNode}
              </ErrorBoundary>
            </TRPCProvider>
          );
        })()}
      </QueryClientProvider>
    );

    setAuditField("createRootDoneAt", nowIso());
    setAuditField("appRenderDispatchedAt", nowIso());
    setAuditField("phase", "main:render-dispatched");
    pushAuditEvent("boot", "render-dispatched", { renderAuditMode });
    console.info("[MAIN] render dispatched", { renderAuditMode });
    console.info("[BOOT] render dispatched", { renderAuditMode });
  } catch (error) {
    renderBootstrapError(error, "main:render");
  }
}
