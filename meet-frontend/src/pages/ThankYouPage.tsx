import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Video, Home, Calendar, Clock, Users, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
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

export default function ThankYouPage() {
  const location = useLocation();
  const isAuthenticated = useIsAuthenticated();
  const [visible, setVisible] = useState(false);
  const meetingInfo = (location.state as MeetingInfo) || {};

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle, #0d9488 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
        aria-hidden="true"
      />

      {/* Soft glow behind card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/5 dark:bg-brand-500/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

      <div
        className={`max-w-md w-full transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        {/* Card */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700/60 shadow-card overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1 bg-gradient-to-r from-brand-400 via-emerald-400 to-brand-500" />

          <div className="p-8 sm:p-10 text-center">
            {/* Animated check icon */}
            <div className="relative mx-auto mb-8 w-fit">
              <div
                className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/25 transition-all duration-500 ${visible ? 'scale-100 rotate-0' : 'scale-75 rotate-12'}`}
              >
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline
                    points="20 6 9 17 4 12"
                    className={`transition-all duration-700 delay-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
                  />
                </svg>
              </div>
              {visible && (
                <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-warning-500 animate-pulse-slow" />
              )}
            </div>

            {/* Heading */}
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-surface-900 dark:text-white mb-1">
              Meeting Ended
            </h1>
            <p className="text-surface-500 dark:text-surface-400 mb-8">
              Thanks for joining — here's your summary
            </p>

            {/* Meeting summary card */}
            {meetingInfo.roomName && (
              <div className="bg-surface-50 dark:bg-surface-900/60 rounded-xl p-4 mb-6 text-left border border-surface-100 dark:border-surface-700/40">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
                    <Video className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-surface-400 dark:text-surface-500 uppercase tracking-wider font-medium">Room</p>
                    <p className="font-semibold text-surface-800 dark:text-surface-200 truncate">{meetingInfo.roomName}</p>
                  </div>
                </div>
                {meetingInfo.duration && (
                  <div className="flex items-center gap-3 pt-3 border-t border-surface-100 dark:border-surface-700/40">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-surface-400 dark:text-surface-500 uppercase tracking-wider font-medium">Duration</p>
                      <p className="font-semibold text-surface-800 dark:text-surface-200">{formatDuration(meetingInfo.duration)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Feature pills */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-surface-100 dark:bg-surface-700/50 text-surface-600 dark:text-surface-300 rounded-full px-3 py-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
                End-to-end encrypted
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-surface-100 dark:bg-surface-700/50 text-surface-600 dark:text-surface-300 rounded-full px-3 py-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-500" />
                HD quality
              </span>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/"
                    className="group w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-sm hover:shadow-card-hover"
                  >
                    <Home className="w-4 h-4" />
                    Back to Dashboard
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    to="/schedule"
                    className="w-full flex items-center justify-center gap-2 bg-surface-100 dark:bg-surface-700/60 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-200 font-medium py-3 px-6 rounded-xl transition-all duration-200"
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule Another
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="group w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-sm hover:shadow-card-hover"
                  >
                    Sign In to Your Account
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <p className="text-surface-500 dark:text-surface-400 text-sm pt-1">
                    Want to host your own meetings?{' '}
                    <Link to="/register" className="text-brand-500 hover:text-brand-600 font-medium underline underline-offset-2">
                      Create an account
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="flex items-center justify-center gap-1.5 mt-6 text-surface-400 dark:text-surface-500 select-none">
          <Video className="w-4 h-4" />
          <span className="text-sm font-semibold tracking-tight">Meet</span>
        </div>
      </div>
    </div>
  );
}
