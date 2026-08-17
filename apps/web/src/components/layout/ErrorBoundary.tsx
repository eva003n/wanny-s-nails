import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
            <h2 className="text-lg font-semibold text-text-primary">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="mt-4 min-h-11 min-w-11 rounded-[--radius-lg] bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              Reload page
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}