import { ReactNode } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

function PageErrorFallbackWrapper({ message }: { message?: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="rounded-full bg-error-100 dark:bg-error-900/30 p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-error-500" />
      </div>
      <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
        Something went wrong
      </h2>
      <p className="text-surface-500 dark:text-surface-400 mb-6 max-w-md">
        {message || 'An unexpected error occurred. Please try again or return to the home page.'}
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition"
        >
          <RefreshCw size={16} />
          Try Again
        </button>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
        >
          <Home size={16} />
          Go Home
        </button>
      </div>
    </div>
  );
}

export function PageErrorBoundary(props: Props) {
  return (
    <ErrorBoundary
      fallback={<PageErrorFallbackWrapper message={props.fallbackMessage} />}
    >
      {props.children}
    </ErrorBoundary>
  );
}
