/**
 * API Keys Page - Admin Panel
 * 
 * Allows admins to view ALL API keys across all moderators,
 * audit usage, and revoke/delete keys if needed.
 * 
 * Note: Moderators manage their own keys via /api-keys in the main app.
 */

import AdminApiKeyManager from '../../components/prashasakah/AdminApiKeyManager';

export default function ApiKeysPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-800">API Keys Management</h1>
          <p className="text-sm text-surface-500 mt-1">
            View and manage all API keys created by moderators and admins
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-brand-800">Admin Oversight</h3>
            <p className="text-sm text-brand-600 mt-1">
              This page shows all API keys across the platform. Moderators create and manage their own keys 
              via <code className="bg-brand-100 px-1 rounded">/api-keys</code> in the main app. 
              As an admin, you can revoke or delete any key if needed.
            </p>
          </div>
        </div>
      </div>

      {/* Admin API Keys Manager */}
      <AdminApiKeyManager />
    </div>
  );
}
