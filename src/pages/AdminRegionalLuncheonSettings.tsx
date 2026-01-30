import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Calendar, Save, AlertCircle, ArrowLeft, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../components/AdminLayout';

interface RegionalDate {
  region: string;
  date: string;
  time: string;
  venue: string;
}

interface RegionalLuncheonSettings {
  id: string;
  name: string;
  registration_deadline: string;
  description: string;
  regional_dates: RegionalDate[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const AdminRegionalLuncheonSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [allSettings, setAllSettings] = useState<RegionalLuncheonSettings[]>([]);
  const [settingToDelete, setSettingToDelete] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<RegionalLuncheonSettings>({
    id: '',
    name: '',
    registration_deadline: '',
    description: '',
    regional_dates: [
      { region: 'West Region', date: '', time: '', venue: '' },
      { region: 'Middle Region', date: '', time: '', venue: '' },
      { region: 'Cookeville Region', date: '', time: '', venue: '' },
      { region: 'Greeneville Region', date: '', time: '', venue: '' },
      { region: 'East Region', date: '', time: '', venue: '' }
    ],
    is_active: true
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/admin/login');
        return;
      }
      if (user.role !== 'admin') {
        navigate('/');
        return;
      }
      fetchSettings();
    }
    // eslint-disable-next-line
  }, [authLoading, user]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all settings
      const { data: allData, error: allError } = await supabase
        .from('regional_luncheon_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (allError) throw allError;
      setAllSettings(allData || []);

      // Fetch active setting
      const { data, error } = await supabase
        .from('regional_luncheon_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          ...data,
          registration_deadline: data.registration_deadline.split('T')[0],
          regional_dates: data.regional_dates || [
            { region: 'West Region', date: '', time: '', venue: '' },
            { region: 'Middle Region', date: '', time: '', venue: '' },
            { region: 'Cookeville Region', date: '', time: '', venue: '' },
            { region: 'Greeneville Region', date: '', time: '', venue: '' },
            { region: 'East Region', date: '', time: '', venue: '' }
          ]
        });
      } else {
        // No active settings, prepare for new entry
        setSettings({
          id: '',
          name: '',
          registration_deadline: '',
          description: '',
          regional_dates: [
            { region: 'West Region', date: '', time: '', venue: '' },
            { region: 'Middle Region', date: '', time: '', venue: '' },
            { region: 'Cookeville Region', date: '', time: '', venue: '' },
            { region: 'Greeneville Region', date: '', time: '', venue: '' },
            { region: 'East Region', date: '', time: '', venue: '' }
          ],
          is_active: true
        });
      }
    } catch (error: any) {
      setError(`Failed to load settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRegionalDateChange = (index: number, field: keyof RegionalDate, value: string) => {
    setSettings(prev => ({
      ...prev,
      regional_dates: prev.regional_dates.map((rd, i) => 
        i === index ? { ...rd, [field]: value } : rd
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate required fields
      if (!settings.name || !settings.registration_deadline) {
        throw new Error('Event name and registration deadline are required');
      }

      // Validate regional dates
      const hasEmptyDates = settings.regional_dates.some(rd => !rd.date || !rd.time);
      if (hasEmptyDates) {
        throw new Error('All regional dates and times are required');
      }

      // Parse deadline date to avoid timezone issues
      const [year, month, day] = settings.registration_deadline.split('-').map(Number);
      const deadlineDate = new Date(year, month - 1, day);
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Reset time for accurate date comparison
      
      if (deadlineDate < now) {
        const proceed = window.confirm('Warning: The registration deadline is in the past. Do you want to continue?');
        if (!proceed) {
          setSaving(false);
          return;
        }
      }

      // If updating existing settings
      if (settings.id) {
        const { error: updateError } = await supabase
          .from('regional_luncheon_settings')
          .update({
            name: settings.name,
            registration_deadline: settings.registration_deadline,
            description: settings.description,
            regional_dates: settings.regional_dates,
            is_active: settings.is_active
          })
          .eq('id', settings.id);

        if (updateError) throw updateError;
      } else {
        // Creating new settings - first deactivate any existing active settings
        const { error: deactivateError } = await supabase
          .from('regional_luncheon_settings')
          .update({ is_active: false })
          .eq('is_active', true);

        if (deactivateError) throw deactivateError;

        // Insert new settings
        const { error: insertError } = await supabase
          .from('regional_luncheon_settings')
          .insert({
            name: settings.name,
            registration_deadline: settings.registration_deadline,
            description: settings.description,
            regional_dates: settings.regional_dates,
            is_active: true
          });

        if (insertError) throw insertError;
      }

      setSuccess('Settings saved successfully!');
      await fetchSettings();
    } catch (error: any) {
      setError(`Failed to save settings: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      setError(null);
      setSuccess(null);

      if (!currentStatus) {
        // Activating this setting - deactivate all others first
        const { error: deactivateError } = await supabase
          .from('regional_luncheon_settings')
          .update({ is_active: false })
          .eq('is_active', true);

        if (deactivateError) throw deactivateError;
      }

      // Toggle the target setting
      const { error: toggleError } = await supabase
        .from('regional_luncheon_settings')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (toggleError) throw toggleError;

      setSuccess(`Settings ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
      await fetchSettings();
    } catch (error: any) {
      setError(`Failed to toggle settings: ${error.message}`);
    }
  };

  const handleDelete = async () => {
    if (!settingToDelete) return;

    try {
      setError(null);
      setSuccess(null);

      const { error: deleteError } = await supabase
        .from('regional_luncheon_settings')
        .delete()
        .eq('id', settingToDelete);

      if (deleteError) throw deleteError;

      setSuccess('Settings deleted successfully!');
      setShowDeleteModal(false);
      setSettingToDelete(null);
      await fetchSettings();
    } catch (error: any) {
      setError(`Failed to delete settings: ${error.message}`);
    }
  };

  const handleCreateNew = () => {
    setSettings({
      id: '',
      name: '',
      registration_deadline: '',
      description: '',
      regional_dates: [
        { region: 'West Region', date: '', time: '', venue: '' },
        { region: 'Middle Region', date: '', time: '', venue: '' },
        { region: 'Cookeville Region', date: '', time: '', venue: '' },
        { region: 'Greeneville Region', date: '', time: '', venue: '' },
        { region: 'East Region', date: '', time: '', venue: '' }
      ],
      is_active: true
    });
    setError(null);
    setSuccess(null);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/admin')}
              className="mr-4 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Regional Luncheon Settings</h1>
          </div>
          {settings.id && (
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Create New Event
            </button>
          )}
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-green-700">{success}</p>
            </div>
          </div>
        )}

        {/* Settings Form */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {settings.id ? 'Edit Settings' : 'Create New Settings'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Event Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Event Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={settings.name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="TAPT Regional Luncheons - April 2026"
                required
              />
            </div>

            {/* Registration Deadline */}
            <div>
              <label htmlFor="registration_deadline" className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Registration Deadline *
              </label>
              <input
                type="date"
                id="registration_deadline"
                name="registration_deadline"
                value={settings.registration_deadline}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Event Description
              </label>
              <textarea
                id="description"
                name="description"
                value={settings.description}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="We're excited to invite you to our TAPT Regional Luncheons this April! These gatherings are a great opportunity for learning, networking, and collaboration..."
              />
              <p className="text-sm text-gray-500 mt-1">Optional - Displayed at the top of the registration form</p>
            </div>

            {/* Regional Dates */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Regional Luncheon Dates & Locations *
              </label>
              <div className="space-y-4">
                {settings.regional_dates.map((rd, index) => (
                  <div key={index} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                    <h4 className="font-semibold text-gray-900 mb-3">{rd.region}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Date *
                        </label>
                        <input
                          type="date"
                          value={rd.date}
                          onChange={(e) => handleRegionalDateChange(index, 'date', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Time *
                        </label>
                        <input
                          type="text"
                          value={rd.time}
                          onChange={(e) => handleRegionalDateChange(index, 'time', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="10:30 AM CST"
                          required
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Venue (Optional)
                        </label>
                        <input
                          type="text"
                          value={rd.venue}
                          onChange={(e) => handleRegionalDateChange(index, 'venue', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Venue name"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>

        {/* All Settings List */}
        {allSettings.length > 0 && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">All Settings</h2>
            <div className="space-y-3">
              {allSettings.map((setting) => (
                <div
                  key={setting.id}
                  className={`border rounded-lg p-4 ${
                    setting.is_active ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">{setting.name}</h3>
                        {setting.is_active && (
                          <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        <Calendar className="inline w-4 h-4 mr-1" />
                        Registration Deadline: {(() => {
                          const dateStr = setting.registration_deadline.split('T')[0];
                          const [year, month, day] = dateStr.split('-');
                          return `${month}/${day}/${year}`;
                        })()}
                      </p>
                      {setting.description && (
                        <p className="text-sm text-gray-500 mt-2 line-clamp-2">{setting.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Created: {new Date(setting.created_at!).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleToggleActive(setting.id, setting.is_active)}
                        className={`p-2 rounded-lg transition-colors ${
                          setting.is_active
                            ? 'text-green-600 hover:bg-green-100'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={setting.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {setting.is_active ? (
                          <ToggleRight className="w-6 h-6" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSettingToDelete(setting.id);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSettingToDelete(null);
          }}
          onConfirm={handleDelete}
          title="Delete Settings"
          message="Are you sure you want to delete these settings? This action cannot be undone."
          confirmText="Delete"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
        />
      </div>
    </AdminLayout>
  );
};

export default AdminRegionalLuncheonSettings;
