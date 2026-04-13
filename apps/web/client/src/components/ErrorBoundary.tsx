import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ReactNode } from "react";
import { getLastPhase, setBootPhase } from "@/lib/bootPhase";

interface Props {
  children: ReactNode;
  routeContext?: string;
  fallbackTitle?: string;
  fallbackDescription?: string;
  reloadLabel?: string;
  fallbackMode?: "fullscreen" | "inline";
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: "" };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    this.setState({ componentStack: info.componentStack });
    setBootPhase(`REACT_BOUNDARY:${this.props.routeContext ?? "unknown"}`);

    // eslint-disable-next-line no-console
    console.error("[FATAL RENDER]", {
      route: this.props.routeContext ?? "unknown",
      phase: getLastPhase(),
      pathname: typeof window !== "undefined" ? window.location.pathname : "unknown",
      message: error.message,
      stack: error.stack,
    });
    // eslint-disable-next-line no-console
    console.error("[COMPONENT STACK]", info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.routeContext !== this.props.routeContext) {
      this.setState({ hasError: false, error: null, componentStack: "" });
    }
  }

  private handleReload = () => {
    if (typeof window === "undefined") return;
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const phase = getLastPhase();
    const pathname = typeof window === "undefined" ? "unknown" : window.location.pathname;
    const stack = this.state.error?.stack ?? "(stack indisponível)";
    const message = this.state.error?.message ?? "Erro desconhecido";
    const mode = this.props.fallbackMode ?? "fullscreen";

    const content = (
      <>
        <div className="mb-4 flex items-center gap-2 text-rose-600">
          <AlertTriangle className="h-5 w-5" />
          <h1 className="text-base font-semibold">{this.props.fallbackTitle ?? "Erro de renderização"}</h1>
        </div>

        <p className="text-sm text-[var(--text-muted)]">
          {this.props.fallbackDescription ?? "Falha de renderização detectada. Diagnóstico completo abaixo."}
        </p>

        <div className="mt-3 space-y-1 text-xs text-[var(--text-muted)]">
          <p><strong>Mensagem:</strong> {message}</p>
          <p><strong>Fase atual:</strong> {phase}</p>
          <p><strong>Pathname:</strong> {pathname}</p>
        </div>

        <pre className="mt-4 max-h-[26vh] overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">{stack}</pre>
        <pre className="mt-3 max-h-[22vh] overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">{this.state.componentStack || "(component stack indisponível)"}</pre>

        <button
          type="button"
          onClick={this.handleReload}
          className={cn(
            "mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white",
            "transition-colors hover:bg-orange-600"
          )}
        >
          <RefreshCw className="h-4 w-4" />
          {this.props.reloadLabel ?? "Recarregar aplicação"}
        </button>
      </>
    );

    if (mode === "inline") {
      return <div className="rounded-lg border border-rose-300 bg-rose-50 p-4">{content}</div>;
    }

    return (
      <div className="nexo-app-shell flex min-h-screen items-center justify-center px-6 py-8">
        <div className="nexo-app-panel-strong w-full max-w-3xl p-6">{content}</div>
      </div>
    );
  }
}

export default ErrorBoundary;
