/**
 * Settings Page - System Configuration (Admin Only)
 */

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useUser } from '../../store/authStore';
import { prashasakahApi, SystemSettings } from '../../services/prashasakahApi';

export default function Settings() {
  const user = useUser();
  const isAdmin = user?.role === 'admin';

  const [settings, setSettings] = useState<Partial<SystemSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Only fetch settings if admin
    if (isAdmin) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await prashasakahApi.getSettings();
      setSettings(response?.data?.settings || {});
    } catch (err) {
      console.error('Failed to load settings:', err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await prashasakahApi.updateSettings(settings);
      toast.success('Settings saved successfully');
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          Access denied. Only administrators can manage system settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure system-wide settings (Admin Only)
        </p>
      </div>

      {/* System Settings - Admin Only */}
      {isAdmin ? (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">System Configuration</h2>
            <p className="text-sm text-gray-500">Configure system-wide settings</p>
          </div>

          <div className="p-6">
            {settings && Object.keys(settings).length > 0 ? (
              <>
                {Object.entries(settings).map(([key, value]) => (
                  <div key={key} className="mb-4">
                    <dt className="block text-sm font-medium text-gray-700 mb-1">{key}</dt>
                    <dd className="text-sm text-gray-500 ml-2">{String(value)}</dd>
                  </div>
                ))}
                
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">No system settings configured.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
