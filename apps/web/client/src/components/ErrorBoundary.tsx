import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  routeContext?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // eslint-disable-next-line no-console
    console.error("[RUNTIME ERROR] route_render_failed", {
      route: this.props.routeContext ?? "unknown",
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.routeContext !== this.props.routeContext) {
      this.setState({ hasError: false, error: null });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="nexo-app-shell flex min-h-screen items-center justify-center px-6">
        <div className="nexo-app-panel-strong w-full max-w-lg p-6">
          <div className="mb-4 flex items-center gap-2 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-base font-semibold">Ocorreu um erro ao carregar esta área</h1>
          </div>

          <p className="text-sm text-[var(--text-muted)]">
            Você pode tentar renderizar novamente sem sair da aplicação.
          </p>

          <button
            type="button"
            onClick={this.handleRetry}
            className={cn(
              "mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white",
              "transition-colors hover:bg-orange-600"
            )}
          >
            <RotateCcw className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
