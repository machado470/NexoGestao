import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  routeContext?: string;
  fallbackTitle?: string;
  fallbackDescription?: string;
  reloadLabel?: string;
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

    // eslint-disable-next-line no-console
    console.error("[RENDER ERROR] route_render_failed", {
      route: this.props.routeContext ?? "unknown",
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
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

    const details = [
      this.state.error
        ? `${this.state.error.name}: ${this.state.error.message}\n\n${this.state.error.stack ?? "(stack indisponível)"}`
        : "Erro desconhecido",
      this.state.componentStack
        ? `\n\n--- Component Stack ---\n${this.state.componentStack}`
        : "",
    ]
      .join("")
      .trim();

    return (
      <div className="nexo-app-shell flex min-h-screen items-center justify-center px-6 py-8">
        <div className="nexo-app-panel-strong w-full max-w-3xl p-6">
          <div className="mb-4 flex items-center gap-2 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-base font-semibold">{this.props.fallbackTitle ?? "Erro de renderização"}</h1>
          </div>

          <p className="text-sm text-[var(--text-muted)]">
            {this.props.fallbackDescription ?? "O app encontrou um erro inesperado durante a renderização. Use os detalhes abaixo para depuração."}
          </p>

          <pre className="mt-4 max-h-[45vh] overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
            {details}
          </pre>

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
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
