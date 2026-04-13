/**
 * Admin API Keys Manager Component
 * 
 * Allows admins to view ALL API keys across all moderators,
 * audit usage, and revoke/delete keys if needed.
 */

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { prashasakahApi, AdminApiKey } from '../../services/prashasakahApi';
import { useAuthStore } from '../../store/authStore';
import { 
  Key, 
  Search, 
  RefreshCw, 
  Trash2, 
  Ban, 
  CheckCircle, 
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export default function AdminApiKeyManager() {
  const { user } = useAuthStore();
  const [keys, setKeys] = useState<AdminApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminApiKey | null>(null);

  // Only admins can access this
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchKeys();
    }
  }, [isAdmin, filterActive, filterRole]);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;
      if (filterActive !== 'all') params.is_active = filterActive;
      if (filterRole !== 'all') params.role = filterRole;
      
      const response = await prashasakahApi.getAllApiKeys(params);
      setKeys(response?.data?.keys || []);
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchKeys();
  };

  const handleRevoke = async (key: AdminApiKey) => {
    if (!confirm(`Revoke API key "${key.name}" for ${key.user.name || key.user.email}?`)) {
      return;
    }

    try {
      setActioningId(key.id);
      await prashasakahApi.revokeApiKey(key.id, 'Admin revoked');
      toast.success('API key revoked');
      await fetchKeys();
    } catch (err: any) {
      console.error('Failed to revoke key:', err);
      toast.error(err.response?.data?.error || 'Failed to revoke key');
    } finally {
      setActioningId(null);
    }
  };

  const handleEnable = async (key: AdminApiKey) => {
    try {
      setActioningId(key.id);
      await prashasakahApi.enableApiKey(key.id, 'Admin enabled');
      toast.success('API key enabled');
      await fetchKeys();
    } catch (err: any) {
      console.error('Failed to enable key:', err);
      toast.error(err.response?.data?.error || 'Failed to enable key');
    } finally {
      setActioningId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;

    try {
      setActioningId(confirmDelete.id);
      await prashasakahApi.deleteApiKey(confirmDelete.id, 'Admin deleted');
      toast.success('API key deleted permanently');
      setConfirmDelete(null);
      await fetchKeys();
    } catch (err: any) {
      console.error('Failed to delete key:', err);
      toast.error(err.response?.data?.error || 'Failed to delete key');
    } finally {
      setActioningId(null);
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Admin Access Required</h3>
        <p className="text-gray-500 mt-2">Only admins can view all API keys.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">All API Keys</h2>
          <p className="text-sm text-gray-500">
            View and manage API keys for all moderators
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Key className="w-4 h-4" />
          <span>{keys.length} total keys</span>
          <span className="text-gray-300">|</span>
          <span className="text-green-600">{keys.filter(k => k.isActive && !isExpired(k.expiresAt)).length} active</span>
          <span className="text-gray-300">|</span>
          <span className="text-red-600">{keys.filter(k => !k.isActive || isExpired(k.expiresAt)).length} inactive</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by key name, user name, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
        </form>
        
        <div className="flex gap-2">
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          >
            <option value="all">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          >
            <option value="all">All Roles</option>
            <option value="moderator">Moderators</option>
            <option value="admin">Admins</option>
          </select>
          
          <button
            onClick={fetchKeys}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Keys Table */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-500 mx-auto" />
          <p className="text-gray-500 mt-2">Loading API keys...</p>
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Key className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No API keys found</p>
          <p className="text-sm text-gray-400 mt-1">
            {searchQuery || filterActive !== 'all' || filterRole !== 'all'
              ? 'Try adjusting your filters'
              : 'Moderators can create API keys from the main app'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{key.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{key.prefix}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-gray-900">{key.user.name || 'No name'}</p>
                        <p className="text-xs text-gray-500">{key.user.email}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                          key.user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {key.user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isExpired(key.expiresAt) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                          <Clock className="w-3 h-3" />
                          Expired
                        </span>
                      ) : key.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                          <Ban className="w-3 h-3" />
                          Revoked
                        </span>
                      )}
                      {key.expiresAt && !isExpired(key.expiresAt) && (
                        <p className="text-xs text-gray-400 mt-1">
                          Expires {formatDistanceToNow(new Date(key.expiresAt), { addSuffix: true })}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">
                        {key.lastUsedAt 
                          ? `Used ${formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}`
                          : 'Never used'
                        }
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">
                        {format(new Date(key.createdAt), 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {key.isActive && !isExpired(key.expiresAt) ? (
                          <button
                            onClick={() => handleRevoke(key)}
                            disabled={actioningId === key.id}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Revoke key"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEnable(key)}
                            disabled={actioningId === key.id}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Enable key"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDelete(key)}
                          disabled={actioningId === key.id}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete key permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete API Key?</h3>
            </div>
            <p className="text-gray-600 mb-4">
              This will permanently delete the API key <strong>"{confirmDelete.name}"</strong> owned by{' '}
              <strong>{confirmDelete.user.name || confirmDelete.user.email}</strong>.
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actioningId === confirmDelete.id}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
