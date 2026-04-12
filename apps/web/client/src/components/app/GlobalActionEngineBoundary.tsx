import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  name?: string;
};

type State = {
  hasError: boolean;
};

export class GlobalActionEngineBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(): State {
    return {
      hasError: true,
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
      return null;
    }
    return this.props.children;
  }
}
