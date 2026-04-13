/**
 * API Keys Page - For Moderators (outside admin panel)
 * 
 * Allows moderators to manage their API keys for external integrations.
 * Uses main app Layout with sidebar.
 */

import { Navigate } from 'react-router-dom';
import { useUser } from '../store/authStore';
import ApiKeyManager from '../components/settings/ApiKeyManager';

export default function ApiKeysPage() {
  const user = useUser();
  const isModerator = user?.role === 'moderator';
  const isAdmin = user?.role === 'admin';

  // Only accessible to moderators and admins
  if (!user || (!isModerator && !isAdmin)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-800 dark:text-white">API Keys</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Manage API keys for external integrations
        </p>
      </div>

      {/* API Keys Manager */}
      <div className="bg-white dark:bg-surface-800 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700">
        <ApiKeyManager />
      </div>
    </div>
  );
}
