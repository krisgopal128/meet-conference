/**
 * Settings Page - System Configuration (Admin Only)
 */

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useUser } from '../../store/authStore';
import { prashasakahApi, SystemSettings } from '../../services/prashasakahApi';
import logger from '../../utils/logger';

type SettingsKeys = keyof SystemSettings;

const sectionLabels: Record<SettingsKeys, { title: string; description: string }> = {
  room_defaults: { title: 'Room Defaults', description: 'Default settings for new rooms' },
  recording: { title: 'Recording', description: 'Meeting recording configuration' },
  email: { title: 'Email', description: 'Email notification settings' },
  alerts: { title: 'Alerts', description: 'System alert thresholds and notifications' },
};

const fieldLabels: Record<string, string> = {
  maxParticipants: 'Max Participants',
  emptyTimeout: 'Empty Timeout (seconds)',
  waitingRoomEnabled: 'Waiting Room Enabled',
  storageType: 'Storage Type',
  retentionDays: 'Retention Days',
  fromAddress: 'From Address',
  fromName: 'From Name',
  serverLoadThreshold: 'Server Load Threshold (%)',
  failedRecordingAlert: 'Failed Recording Alert',
  userReportAlert: 'User Report Alert',
  unusualActivityAlert: 'Unusual Activity Alert',
};

function SettingInput({ value, onChange, fieldKey }: {
  value: unknown;
  onChange: (val: unknown) => void;
  fieldKey: string;
}) {
  if (typeof value === 'boolean') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? 'bg-brand-600' : 'bg-surface-300'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          value ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    );
  }

  if (fieldKey === 'storageType') {
    return (
      <select aria-label="Filter"
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-xs px-3 py-2 border border-surface-300 rounded-lg text-surface-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition"
      >
        <option value="local">Local</option>
        <option value="s3">S3</option>
      </select>
    );
  }

  if (typeof value === 'number') {
    return (
      <input aria-label="Value"
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full max-w-xs px-3 py-2 border border-surface-300 rounded-lg text-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition"
      />
    );
  }

  return (
    <input aria-label="Search"
      type="text"
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      className="w-full max-w-xs px-3 py-2 border border-surface-300 rounded-lg text-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition"
    />
  );
}

export default function Settings() {
  const user = useUser();
  const isAdmin = user?.role === 'admin';

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Track mount status to prevent state updates after unmount
  const mountedRef = useRef(true);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await prashasakahApi.getSettings();
      if (mountedRef.current) {
        setSettings(response?.data?.settings || null);
      }
    } catch (err) {
      if (mountedRef.current) {
        logger.error('Failed to load settings:', err);
        toast.error('Failed to load settings');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (isAdmin) {
      fetchSettings();
    } else {
      setLoading(false);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [isAdmin]);

  const updateField = (section: SettingsKeys, field: string, value: unknown) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [section]: {
        ...settings[section],
        [field]: value,
      },
    });
  };

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      await prashasakahApi.updateSettings(settings);
      toast.success('Settings saved successfully');
    } catch (err) {
      logger.error('Failed to save settings:', err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-surface-200 rounded w-1/3" />
        <div className="h-40 bg-surface-200 rounded" />
        <div className="h-40 bg-surface-200 rounded" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-surface-500">
          Access denied. Only administrators can manage system settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-800">System Settings</h1>
          <p className="text-sm text-surface-500 mt-1">
            Configure system-wide settings (Admin Only)
          </p>
        </div>
      </div>

      {settings ? (
        <>
          {(Object.entries(settings) as [SettingsKeys, Record<string, unknown>][]).map(([sectionKey, sectionValue]) => (
            <div key={sectionKey} className="bg-white rounded-xl border border-surface-200 shadow-sm">
              <div className="p-5 border-b border-surface-100">
                <h2 className="text-lg font-semibold text-surface-800">
                  {sectionLabels[sectionKey]?.title || sectionKey}
                </h2>
                <p className="text-sm text-surface-500 mt-0.5">
                  {sectionLabels[sectionKey]?.description || ''}
                </p>
              </div>

              <div className="p-5 space-y-5">
                {Object.entries(sectionValue).map(([fieldKey, fieldValue]) => (
                  <div key={fieldKey} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <label className="text-sm font-medium text-surface-700">
                      {fieldLabels[fieldKey] || fieldKey}
                    </label>
                    <SettingInput
                      value={fieldValue}
                      fieldKey={fieldKey}
                      onChange={(val) => updateField(sectionKey, fieldKey, val)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : 'Save All Settings'}
            </button>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-surface-200 p-8 text-center">
          <p className="text-surface-500">No system settings available.</p>
        </div>
      )}
    </div>
  );
}
