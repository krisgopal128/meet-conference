import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  fallbackMessage?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center p-4">
          <div className="card p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-danger-100 dark:bg-danger-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-xl font-bold text-surface-800 dark:text-surface-100 mb-2">Something went wrong</h1>
            <p className="text-surface-500 dark:text-surface-400 mb-6 text-sm">
              {this.props.fallbackMessage || (import.meta.env.DEV
                ? (this.state.error?.message || 'An unexpected error occurred')
                : 'An unexpected error occurred. Please try again.')}
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="btn-primary w-full"
            >
              Go Home
            </button>
            <button
              onClick={this.handleRetry}
              className="btn-secondary w-full mt-3"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
