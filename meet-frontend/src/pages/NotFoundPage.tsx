import { Link } from 'react-router-dom';
import { Home, AlertTriangle, Video } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center p-4 sm:p-8">
      <div className="text-center max-w-md">
        {/* 404 Number */}
        <div className="mb-6">
          <span className="font-display text-8xl md:text-9xl font-bold text-surface-200 dark:text-surface-700">
            404
          </span>
        </div>

        {/* Icon */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/30">
            <AlertTriangle 
              className="w-8 h-8 text-brand-500" 
              aria-hidden="true" 
            />
          </div>
        </div>

        {/* Message */}
        <h1 className="font-display text-2xl md:text-3xl font-bold text-surface-800 dark:text-white mb-3">
          Page not found
        </h1>
        <p className="text-surface-500 dark:text-surface-400 mb-8">
          The page or meeting you're looking for doesn't exist or may have ended.
        </p>

        {/* Go Home Button */}
        <Link
          to="/"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Home size={18} aria-hidden="true" />
          <span>Go Home</span>
        </Link>

        {/* Secondary action */}
        <div className="mt-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400 hover:text-brand-500 dark:hover:text-brand-400 transition"
          >
            <Video size={16} aria-hidden="true" />
            <span>Start a new meeting</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
