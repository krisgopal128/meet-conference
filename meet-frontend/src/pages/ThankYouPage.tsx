import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Video, Home, Calendar, Clock, Users, CheckCircle, Sparkles } from 'lucide-react';
import { useIsAuthenticated } from '../store/authStore';

interface MeetingInfo {
  roomName?: string;
  duration?: number;
}

function formatDuration(minutes?: number): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

const ANIMATION_DELAYS = {
  delay200: { animationDelay: '200ms' },
  delay400: { animationDelay: '400ms' },
  delay600: { animationDelay: '600ms' },
} as const;

export default function ThankYouPage() {
  const location = useLocation();
  const isAuthenticated = useIsAuthenticated();
  const [showConfetti, setShowConfetti] = useState(true);
  const meetingInfo = (location.state as MeetingInfo) || {};

  // Hide confetti after animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-surface-50 to-emerald-50 dark:from-surface-900 dark:via-surface-900 dark:to-surface-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {showConfetti && (
          <>
            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-brand-400 rounded-full animate-ping" aria-hidden="true" />
            <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-emerald-400 rounded-full animate-ping" style={ANIMATION_DELAYS.delay200} aria-hidden="true" />
            <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-purple-400 rounded-full animate-ping" style={ANIMATION_DELAYS.delay400} aria-hidden="true" />
            <div className="absolute top-1/2 right-1/3 w-2 h-2 bg-yellow-400 rounded-full animate-ping" style={ANIMATION_DELAYS.delay600} aria-hidden="true" />
          </>
        )}
      </div>

      <div className="max-w-lg w-full">
        {/* Main Card */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-6 sm:p-8 text-center relative">
          {/* Success Icon */}
          <div className="relative inline-block mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-brand-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-brand-500/30">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            {showConfetti && (
              <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 animate-bounce" />
            )}
          </div>

          {/* Thank You Message */}
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Thank You!
          </h1>
          <p className="text-surface-600 dark:text-surface-300 text-lg mb-6">
            Your meeting has ended successfully
          </p>

          {/* Meeting Summary */}
          {meetingInfo.roomName && (
            <div className="bg-surface-50 dark:bg-surface-900/50 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-surface-600 dark:text-surface-300 min-w-0">
                <Video className="w-4 h-4 shrink-0" />
                <span className="font-medium truncate">{meetingInfo.roomName}</span>
              </div>
              {meetingInfo.duration && (
                <div className="flex items-center justify-center gap-2 text-surface-500 dark:text-surface-400 text-sm mt-2">
                  <Clock className="w-4 h-4" />
                  <span>Duration: {formatDuration(meetingInfo.duration)}</span>
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
            <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-2 sm:p-3">
              <Video className="w-4 h-4 sm:w-5 sm:h-5 text-brand-500 mx-auto mb-1" />
              <div className="text-xs text-surface-500 dark:text-surface-400">HD Video</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-2 sm:p-3">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 mx-auto mb-1" />
              <div className="text-xs text-surface-500 dark:text-surface-400">Connected</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-2 sm:p-3">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 mx-auto mb-1" />
              <div className="text-xs text-surface-500 dark:text-surface-400">Secure</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {isAuthenticated ? (
              <>
                <Link
                  to="/"
                  className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-brand-500/30 hover:shadow-xl hover:shadow-brand-500/40"
                >
                  <Home className="w-5 h-5" />
                  Back to Dashboard
                </Link>
                <Link
                  to="/schedule"
                  className="w-full flex items-center justify-center gap-2 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-200 font-medium py-3 px-6 rounded-xl transition-all duration-200"
                >
                  <Calendar className="w-5 h-5" />
                  Schedule Another Meeting
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-brand-500/30 hover:shadow-xl hover:shadow-brand-500/40"
                >
                  <Home className="w-5 h-5" />
                  Sign In to Your Account
                </Link>
                <p className="text-surface-500 dark:text-surface-400 text-sm">
                  Want to host your own meetings?{' '}
                  <Link to="/register" className="text-brand-500 hover:text-brand-600 font-medium">
                    Create an account
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mt-6 text-surface-400 dark:text-surface-500">
          <Video className="w-5 h-5" />
          <span className="font-semibold">Meet</span>
        </div>
      </div>
    </div>
  );
}
