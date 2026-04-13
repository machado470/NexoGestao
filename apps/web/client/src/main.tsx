import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";

const ROOT_ID = "root";

function RootBootProbe() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
        padding: "1rem",
      }}
      data-testid="boot-probe"
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0 }}>NexoGestão boot probe</h1>
        <p style={{ marginTop: 8 }}>
          JS carregou e o mount em #{ROOT_ID} funcionou.
        </p>
      </div>
    </div>
  );
}

function FatalBootstrapScreen({ reason }: { reason: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
        background: "#0f172a",
        color: "#e2e8f0",
        padding: "1rem",
      }}
      role="alert"
    >
      <div style={{ maxWidth: 640 }}>
        <h1 style={{ marginTop: 0 }}>Falha de bootstrap do frontend</h1>
        <p>{reason}</p>
        <p style={{ opacity: 0.85 }}>
          Abra o console para ver o erro completo. Esta tela evita branco absoluto silencioso.
        </p>
      </div>
    </div>
  );
}

function shouldRunBootProbe() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("bootProbe") === "1";
}

function mountApp() {
  const rootElement = document.getElementById(ROOT_ID);

  if (!rootElement) {
    throw new Error(`Root element #${ROOT_ID} not found`);
  }

  const root = createRoot(rootElement);
  const useProbe = shouldRunBootProbe();

  root.render(
    <React.StrictMode>
      {useProbe ? <RootBootProbe /> : <App />}
    </React.StrictMode>
  );
}

try {
  window.addEventListener("error", (event) => {
    // eslint-disable-next-line no-console
    console.error("[web] uncaught_error", event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    // eslint-disable-next-line no-console
    console.error("[web] unhandled_rejection", event.reason);
  });

  mountApp();
} catch (error) {
  const reason = error instanceof Error ? `${error.name}: ${error.message}` : "Erro desconhecido";
  // eslint-disable-next-line no-console
  console.error("[web] fatal_bootstrap_error", error);

  const fallbackRoot = document.getElementById(ROOT_ID);

  if (fallbackRoot) {
    createRoot(fallbackRoot).render(<FatalBootstrapScreen reason={reason} />);
  }
}
