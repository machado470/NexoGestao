import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  name?: string;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class GlobalActionEngineBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    const label = this.props.name ?? "GlobalActionEngine";
    console.error(`[${label}] render failure`, {
      component: label,
      error,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-4 mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
          <p className="font-semibold">
            Falha ao renderizar {this.props.name ?? "componente"}.
          </p>
          <pre className="mt-1 whitespace-pre-wrap break-words text-[11px]">
            {this.state.error?.stack ?? this.state.error?.message ?? "Erro desconhecido"}
          </pre>
          <button
            type="button"
            className="mt-2 rounded border border-red-500/40 px-2 py-1 text-[11px]"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
