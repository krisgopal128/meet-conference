/**
 * API Keys Manager Component
 * 
 * Allows moderators to generate and manage API keys for external integrations.
 * Only shows for users with moderator or admin role.
 */

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { apiKeysApi, ApiKey, ApiKeyWithSecret } from '../../services/apiKeysApi';
import { useUser } from '../../store/authStore';
import { Copy, Key, Plus, RefreshCw, Trash2, Eye, EyeOff, Check, X, AlertTriangle } from 'lucide-react';
import logger from '../../utils/logger';

// Type guard for Axios-like errors
function isApiError(err: unknown): err is { response?: { data?: { error?: string } } } {
  return typeof err === 'object' && err !== null && 'response' in (err as object);
}

interface ApiKeyManagerProps {
  className?: string;
}

export default function ApiKeyManager({ className = '' }: ApiKeyManagerProps) {
  const user = useUser();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState<number | undefined>(undefined);
  const [generatedKey, setGeneratedKey] = useState<ApiKeyWithSecret | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Check if user is moderator or admin
  const canManageKeys = user?.role === 'moderator' || user?.role === 'admin';

  useEffect(() => {
    if (canManageKeys) {
      fetchKeys();
    }
  }, [canManageKeys]);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const response = await apiKeysApi.list();
      setKeys(response?.data?.keys || []);
    } catch (err) {
      logger.error('Failed to fetch API keys:', err);
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }

    try {
      setCreating(true);
      const response = await apiKeysApi.create({
        name: newKeyName.trim(),
        expires_in_days: newKeyExpiry,
      });
      
      setGeneratedKey(response.data);
      setNewKeyName('');
      setNewKeyExpiry(undefined);
      setShowCreateModal(false);
      setShowKey(true);
      
      // Refresh the list
      await fetchKeys();
      
      toast.success('API key created! Copy it now - it won\'t be shown again.');
     } catch (err) {
       logger.error('Failed to create API key:', err);
       if (isApiError(err)) {
         toast.error(err.response?.data?.error || 'Failed to create API key');
       } else {
         toast.error('Failed to create API key');
       }
     } finally {
      setCreating(false);
    }
  };

  const handleCopyKey = async () => {
    if (!generatedKey?.key) return;
    
    try {
      await navigator.clipboard.writeText(generatedKey.key);
      setCopied(true);
      toast.success('API key copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('Failed to copy:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleRegenerateKey = async (id: string) => {
    if (!confirm('Are you sure? The old key will stop working immediately.')) {
      return;
    }

    try {
      const response = await apiKeysApi.regenerate(id);
      setGeneratedKey(response.data);
      setShowKey(true);
      await fetchKeys();
      toast.success('API key regenerated! Copy it now - it won\'t be shown again.');
     } catch (err) {
       logger.error('Failed to regenerate API key:', err);
       if (isApiError(err)) {
         toast.error(err.response?.data?.error || 'Failed to regenerate API key');
       } else {
         toast.error('Failed to regenerate API key');
       }
     }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key? It will stop working immediately.')) {
      return;
    }

    try {
      setDeletingId(id);
      await apiKeysApi.delete(id);
      await fetchKeys();
      toast.success('API key deleted');
     } catch (err) {
       logger.error('Failed to delete API key:', err);
       if (isApiError(err)) {
         toast.error(err.response?.data?.error || 'Failed to delete API key');
       } else {
         toast.error('Failed to delete API key');
       }
     } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (key: ApiKey) => {
    try {
      await apiKeysApi.update(key.id, { is_active: !key.is_active });
      await fetchKeys();
      toast.success(key.is_active ? 'API key disabled' : 'API key enabled');
     } catch (err) {
       logger.error('Failed to update API key:', err);
       if (isApiError(err)) {
         toast.error(err.response?.data?.error || 'Failed to update API key');
       } else {
         toast.error('Failed to update API key');
       }
     }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Don't show for non-moderators
  if (!canManageKeys) {
    return null;
  }

  return (
    <div className={`bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-brand-600" />
            <div>
              <h3 className="text-lg font-semibold text-surface-800 dark:text-white">API Keys</h3>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                Generate API keys for external integrations (e.g., Tuition Notebook)
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Key
          </button>
        </div>
      </div>

      {/* Generated Key Modal */}
      {generatedKey && (
        <div className="p-6 bg-emerald-50 dark:bg-emerald-500/10 border-b border-emerald-200 dark:border-emerald-500/20">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-success-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-success-800 dark:text-success-300 mb-2">
                API Key Created - Copy Now!
              </h4>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-3">
                This is the only time you'll see this key. Copy it now and store it securely.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-white dark:bg-surface-900 rounded border border-emerald-200 dark:border-emerald-500/20 font-mono text-sm overflow-x-auto text-surface-800 dark:text-surface-200">
                  {showKey ? generatedKey.key : '••••••••••••••••••••••••••••••••'}
                </code>
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="p-2 text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
                  title={showKey ? 'Hide' : 'Show'}
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                <button
                  onClick={handleCopyKey}
                  className={`p-2 rounded transition-colors ${
                    copied ? 'text-success-600 bg-success-50 dark:bg-success-500/10' : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700'
                  }`}
                  title="Copy"
                  aria-label="Copy"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-success-600 dark:text-success-400 mt-2">
                Key prefix: {generatedKey.prefix}...
              </p>
            </div>
            <button
              onClick={() => {
                setGeneratedKey(null);
                setShowKey(false);
              }}
              className="p-1 text-success-600 dark:text-success-400 hover:text-success-800 dark:hover:text-success-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="p-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Key className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No API keys yet</p>
            <p className="text-sm">Create one to integrate with external apps</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div
                key={key.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  key.is_active ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900 truncate">{key.name}</h4>
                    {!key.is_active && (
                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                        Disabled
                      </span>
                    )}
                    {key.expires_at && new Date(key.expires_at) < new Date() && (
                      <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">
                        Expired
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="font-mono">{key.prefix}...</span>
                    <span>Created: {formatDate(key.created_at)}</span>
                    <span>Last used: {formatDate(key.last_used_at)}</span>
                    {key.expires_at && (
                      <span>Expires: {formatDate(key.expires_at)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(key)}
                    className={`p-2 rounded transition-colors ${
                      key.is_active
                        ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                        : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                    }`}
                    title={key.is_active ? 'Disable' : 'Enable'}
                  >
                    {key.is_active ? (
                      <X className="w-4 h-4" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleRegenerateKey(key.id)}
                    className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                    title="Regenerate"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    disabled={deletingId === key.id}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create API Key</h3>
              <p className="text-sm text-gray-500 mt-1">
                Generate a new API key for external integrations
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Tuition Notebook Integration"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  A descriptive name to help you identify this key later
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration (Optional)
                </label>
                <select
                  value={newKeyExpiry || ''}
                  onChange={(e) => setNewKeyExpiry(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="">Never expires</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">1 year</option>
                </select>
              </div>
              <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-800">
                  The API key will only be shown once. Make sure to copy it immediately after creation.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewKeyName('');
                  setNewKeyExpiry(undefined);
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateKey}
                disabled={creating || !newKeyName.trim()}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Creating...' : 'Create Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
