import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "./button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Structured error logging for APM/Sentry/RUM symbolication
    console.error("[Client ErrorBoundary]", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex min-h-screen flex-col items-center justify-center bg-stone-50 p-4 text-stone-900 dark:bg-stone-950 dark:text-stone-100"
        >
          <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500">
              <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden="true" />
              <h1 className="text-lg font-semibold tracking-tight">Application Error</h1>
            </div>

            <p className="mt-3 text-sm text-stone-600 dark:text-stone-400">
              An unexpected error prevented this view from rendering. Your recorded data remains safe.
            </p>

            {this.state.error?.message && (
              <div className="mt-4 rounded-md bg-stone-100 p-3 font-mono text-xs text-stone-800 dark:bg-stone-800 dark:text-stone-200">
                {this.state.error.message}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Try again
              </Button>
              <Button
                size="sm"
                onClick={this.handleReload}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reload application
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
