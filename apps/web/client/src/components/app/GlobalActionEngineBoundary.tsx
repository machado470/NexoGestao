import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
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

  componentDidCatch(error: Error) {
    console.error("[GlobalActionEngine] render failure", error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}
