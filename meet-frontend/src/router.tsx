import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  RouteObject,
  Navigate,
} from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load all pages
const HomePage = lazy(() => import('./pages/HomePage'));
const RoomPage = lazy(() => import('./pages/RoomPage'));
const PreJoinPage = lazy(() => import('./pages/PreJoinPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const RecordingsPage = lazy(() => import('./pages/RecordingsPage'));
const MeetingDetailPage = lazy(() => import('./pages/MeetingDetailPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const PiPTestPage = lazy(() => import('./pages/PiPTestPage'));
const ThankYouPage = lazy(() => import('./pages/ThankYouPage'));
const ApiKeysPage = lazy(() => import('./pages/ApiKeysPage'));

// Prashasakah Admin Panel pages
const PrashasakahLayout = lazy(() => import('./pages/prashasakah/PrashasakahLayout'));
const Dashboard = lazy(() => import('./pages/prashasakah/Dashboard'));
const Users = lazy(() => import('./pages/prashasakah/Users'));
const UserDetail = lazy(() => import('./pages/prashasakah/UserDetail'));
const Meetings = lazy(() => import('./pages/prashasakah/Meetings'));
const MeetingDetail = lazy(() => import('./pages/prashasakah/MeetingDetail'));
const AuditLogs = lazy(() => import('./pages/prashasakah/AuditLogs'));
const Alerts = lazy(() => import('./pages/prashasakah/Alerts'));
const Settings = lazy(() => import('./pages/prashasakah/Settings'));
const ApiKeys = lazy(() => import('./pages/prashasakah/ApiKeys'));

// Loading fallback component - matches website theme
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-surface-50 dark:bg-surface-900">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-surface-500 dark:text-surface-400 text-sm">Loading...</p>
    </div>
  </div>
);

// Wrap lazy component with Suspense
const withSuspense = (Component: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

// Route configuration
const routes: RouteObject[] = [
  // Standalone full-screen pages (no sidebar)
  {
    path: '/join/:roomName',
    element: withSuspense(PreJoinPage),
  },
  {
    path: '/room/:roomName',
    element: withSuspense(RoomPage),
  },
  {
    path: '/login',
    element: withSuspense(LoginPage),
  },
  {
    path: '/register',
    element: withSuspense(RegisterPage),
  },
  {
    path: '/forgot-password',
    element: withSuspense(ForgotPasswordPage),
  },
  {
    path: '/reset-password/:token',
    element: withSuspense(ResetPasswordPage),
  },
  {
    path: '/404',
    element: withSuspense(NotFoundPage),
  },
  {
    path: '/thank-you',
    element: withSuspense(ThankYouPage),
  },
  {
    path: '/pip-test',
    element: withSuspense(PiPTestPage),
  },
  
  // Pages with Layout (sidebar)
  {
    element: <Layout />,
    children: [
      // Protected routes
      {
        index: true,
        element: (
          <ProtectedRoute>
            {withSuspense(HomePage)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'schedule',
        element: (
          <ProtectedRoute>
            {withSuspense(SchedulePage)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'history',
        element: (
          <ProtectedRoute>
            {withSuspense(HistoryPage)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'history/:id',
        element: (
          <ProtectedRoute>
            {withSuspense(MeetingDetailPage)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'recordings',
        element: (
          <ProtectedRoute>
            {withSuspense(RecordingsPage)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'api-keys',
        element: (
          <ProtectedRoute>
            {withSuspense(ApiKeysPage)}
          </ProtectedRoute>
        ),
      },
    ],
  },
  
  // Prashasakah Admin Panel routes (admin only, desktop only)
  {
    path: '/prashasakah',
    element: <ProtectedRoute requiredRole="admin">{withSuspense(PrashasakahLayout)}</ProtectedRoute>,
    children: [
      {
        index: true,
        element: withSuspense(Dashboard),
      },
      {
        path: 'users',
        element: withSuspense(Users),
      },
      {
        path: 'users/:id',
        element: withSuspense(UserDetail),
      },
      {
        path: 'meetings',
        element: withSuspense(Meetings),
      },
      {
        path: 'meetings/:id',
        element: withSuspense(MeetingDetail),
      },
      {
        path: 'audit-logs',
        element: withSuspense(AuditLogs),
      },
      {
        path: 'alerts',
        element: withSuspense(Alerts),
      },
      {
        path: 'api-keys',
        element: withSuspense(ApiKeys),
      },
      {
        path: 'settings',
        element: withSuspense(Settings),
      },
    ],
  },
  
  // 404 catch-all (no sidebar)
  {
    path: '*',
    element: <Navigate to="/404" replace />,
  },
];

// Create browser router
export const router = createBrowserRouter(routes);
