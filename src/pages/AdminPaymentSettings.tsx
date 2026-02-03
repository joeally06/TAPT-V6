/**
 * Email Settings Page
 * Manage payment receipt email template variables and admin notification email
 */

import React, { useState, useEffect } from 'react';
import { fetchSettingsByCategory, updateSetting, getSetting, upsertSetting } from '@/lib/settings';
import type { ParsedSetting } from '@/types/settings';
import AdminLayout from '../components/AdminLayout';

export default function AdminPaymentSettings() {
  const [settings, setSettings] = useState<ParsedSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Fetch payment settings
      const paymentData = await fetchSettingsByCategory('payment');
      
      // Also fetch admin_notification_email setting
      const adminEmailValue = await getSetting('admin_notification_email');
      
      // Combine payment settings with admin notification email
      const allSettings: ParsedSetting[] = [
        // Add admin notification email at the top
        {
          id: 'admin_notification_email',
          key: 'admin_notification_email',
          value: adminEmailValue || 'info@tapt.org',
          updated_at: new Date().toISOString()
        },
        ...paymentData
      ];
      
      setSettings(allSettings);
      
      const values: Record<string, string> = {};
      allSettings.forEach(s => values[s.key] = s.value);
      setEditedValues(values);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const changedKeys = settings.filter(s => hasChanges(s.key)).map(s => s.key);
      
      for (const key of changedKeys) {
        // Use upsert for admin_notification_email since it might not exist in DB yet
        const result = key === 'admin_notification_email'
          ? await upsertSetting(key, editedValues[key])
          : await updateSetting(key, editedValues[key]);
          
        if (result.error) {
          alert(`Error saving ${formatLabel(key)}: ${result.error}`);
          setSaving(false);
          return;
        }
      }
      
      await loadSettings();
      alert('All changes saved successfully!');
    } catch (err) {
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleResetAll = () => {
    const values: Record<string, string> = {};
    settings.forEach(s => values[s.key] = s.value);
    setEditedValues(values);
  };

  const hasChanges = (key: string) => {
    const original = settings.find(s => s.key === key)?.value;
    return original !== editedValues[key];
  };

  const hasAnyChanges = () => {
    return settings.some(s => hasChanges(s.key));
  };

  const isOptional = (key: string) => {
    return key === 'payment_remittance_address_line2';
  };

  const formatLabel = (key: string): string => {
    // Custom labels for specific keys
    if (key === 'admin_notification_email') {
      return 'Admin Notification Email (Registration Alerts)';
    }
    
    return key
      .replace('payment_', '')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const isMultiline = (key: string): boolean => {
    return key.includes('footer') || key.includes('subject');
  };

  const getSettingDescription = (key: string): string | null => {
    const descriptions: Record<string, string> = {
      'admin_notification_email': 'Email address where registration notifications will be sent. This is where you receive alerts about new conference, tech conference, and exhibitor registrations.',
      'payment_contact_email': 'Email address shown in payment receipts for payment-related inquiries.',
    };
    return descriptions[key] || null;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="max-w-3xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-semibold mb-2">Error</h3>
            <p className="text-red-600 text-sm mb-3">{error}</p>
            <button onClick={loadSettings} className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700">
              Retry
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Email Template Settings</h1>
          <p className="mt-1 text-gray-600">Configure payment receipt email variables and notification recipients</p>
        </div>

      {settings.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No settings found</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Setting
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {settings.map((setting) => {
                const changed = hasChanges(setting.key);
                const optional = isOptional(setting.key);
                const description = getSettingDescription(setting.key);
                
                return (
                  <tr key={setting.id} className={changed ? 'bg-yellow-50' : ''}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {formatLabel(setting.key)}
                        {optional && <span className="ml-1 text-xs text-gray-500">(optional)</span>}
                      </div>
                      {description && (
                        <p className="mt-1 text-xs text-gray-500">{description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isMultiline(setting.key) ? (
                        <textarea
                          value={editedValues[setting.key] || ''}
                          onChange={(e) => setEditedValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                          rows={2}
                          placeholder={optional ? 'Optional' : ''}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : (
                        <input
                          type="text"
                          value={editedValues[setting.key] || ''}
                          onChange={(e) => setEditedValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                          placeholder={optional ? 'Optional' : ''}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {/* Action Buttons */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={handleResetAll}
              disabled={saving || !hasAnyChanges()}
              className="px-5 py-2.5 text-sm font-medium text-gray-900 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              Reset All
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving || !hasAnyChanges()}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:border-blue-300 disabled:cursor-not-allowed shadow-sm"
            >
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}
