import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, DollarSign, Clock, Save, AlertCircle, Trash2, Archive, ToggleLeft, ToggleRight } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../components/AdminLayout';

interface TechConferenceSettings {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  registration_end_date: string;
  location: string;
  venue: string;
  fee: number;
  payment_instructions: string;
  description: string;
  is_active: boolean;
}

export const AdminTechConferenceSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRolloverModal, setShowRolloverModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isRollingOver, setIsRollingOver] = useState(false);
  const [allSettings, setAllSettings] = useState<TechConferenceSettings[]>([]);
  
  const [settings, setSettings] = useState<TechConferenceSettings>({
    id: '',
    name: '',
    start_date: '',
    end_date: '',
    registration_end_date: '',
    location: '',
    venue: '',
    fee: 250.00,
    payment_instructions: '',
    description: '',
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
        .from('tech_conference_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (allError) throw allError;
      setAllSettings(allData || []);

      // Fetch active setting
      const { data, error } = await supabase
        .from('tech_conference_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        setSettings({
          ...data,
          start_date: data.start_date.split('T')[0],
          end_date: data.end_date.split('T')[0],
          registration_end_date: data.registration_end_date.split('T')[0],
          is_active: data.is_active
        });
      }
    } catch (error: any) {
      setError(`Failed to load tech conference settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchUUID = async (): Promise<string> => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-uuid`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate UUID');
      }

      const { uuid } = await response.json();
      return uuid;
    } catch (error: any) {
      console.error('Error fetching UUID:', error);
      throw error;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    setSettings(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // If no ID exists or ID is empty, fetch a new UUID from the server
      if (!settings.id || settings.id.trim() === '') {
        const uuid = await fetchUUID();
        setSettings(prev => ({ ...prev, id: uuid }));
      }

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      // Use Edge Function for upsert (add/update)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-tech-conference-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          ...settings, 
          id: settings.id.trim() === '' ? await fetchUUID() : settings.id,
          updated_at: new Date().toISOString() 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save tech conference settings');
      }
      
      setSuccess('Tech conference settings saved successfully!');
      await fetchSettings();
    } catch (error: any) {
      setError(`Failed to save tech conference settings: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearTable = async () => {
    setClearing(true);
    setError(null);
    setSuccess(null);

    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      // Use Edge Function for delete/clear
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-tech-conference-settings`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ clear: true })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear tech conference settings');
      }
      
      setSuccess('Tech conference settings cleared successfully!');
      const uuid = await fetchUUID();
      setSettings({
        id: uuid,
        name: '',
        start_date: '',
        end_date: '',
        registration_end_date: '',
        location: '',
        venue: '',
        fee: 250.00,
        payment_instructions: '',
        description: '',
        is_active: true
      });
    } catch (error: any) {
      setError(`Failed to clear tech conference settings: ${error.message}`);
    } finally {
      setClearing(false);
      setShowClearModal(false);
    }
  };

  const handleRollover = async () => {
    try {
      setIsRollingOver(true);
      setError(null);

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined in the environment');
      }

      try {
        new URL(supabaseUrl);
      } catch (e) {
        throw new Error('VITE_SUPABASE_URL is invalid');
      }

      if (!settings.start_date || !settings.end_date || !settings.registration_end_date) {
        throw new Error('Please set all required dates before rolling over');
      }

      // If no ID exists or ID is empty, fetch a new UUID from the server
      let settingsId = settings.id;
      if (!settingsId || settingsId.trim() === '') {
        settingsId = await fetchUUID();
        setSettings(prev => ({ ...prev, id: settingsId }));
      }

      const newSettings = {
        ...settings,
        id: settingsId,
        start_date: settings.start_date,
        end_date: settings.end_date,
        registration_end_date: settings.registration_end_date,
      };

      const response = await fetch(
        `${supabaseUrl}/functions/v1/rollover`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'tech-conference',
            settings: newSettings,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to rollover tech conference: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to rollover tech conference');
      }

      setSuccess('Tech conference rolled over successfully! Previous registrations have been archived.');
      await fetchSettings();
    } catch (error: any) {
      setError(`Failed to rollover tech conference: ${error.message}`);
    } finally {
      setIsRollingOver(false);
      setShowRolloverModal(false);
    }
  };

  const handleToggleActive = async (settingId: string) => {
    try {
      setError(null);
      setSuccess(null);
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // First, deactivate all settings
      const { error: deactivateError } = await supabase
        .from('tech_conference_settings')
        .update({ is_active: false })
        .neq('id', 'no-match'); // Update all records

      if (deactivateError) throw deactivateError;

      // Then activate the selected setting
      const { error: activateError } = await supabase
        .from('tech_conference_settings')
        .update({ is_active: true })
        .eq('id', settingId);

      if (activateError) throw activateError;

      setSuccess('Active tech conference setting updated successfully!');
      await fetchSettings();
    } catch (error: any) {
      setError(`Failed to update active setting: ${error.message}`);
    }
  };

  if (loading || authLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tech Conference Settings</h1>
          <p className="mt-1 text-gray-600">Manage tech conference details and registration settings</p>
        </div>
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Available Tech Conference Settings */}
        {allSettings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-secondary mb-4">Available Tech Conference Settings</h2>
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dates
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allSettings.map((setting) => (
                    <tr key={setting.id} className={setting.is_active ? "bg-green-50" : ""}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{setting.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {(() => {
                            const [y1, m1, d1] = setting.start_date.split('T')[0].split('-');
                            const [y2, m2, d2] = setting.end_date.split('T')[0].split('-');
                            return `${m1}/${d1}/${y1} - ${m2}/${d2}/${y2}`;
                          })()}
                        </div>
                        <div className="text-xs text-gray-500">
                          Reg. Deadline: {(() => {
                            const [y, m, d] = setting.registration_end_date.split('T')[0].split('-');
                            return `${m}/${d}/${y}`;
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{setting.venue}, {setting.location}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          setting.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {setting.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            if (!setting.is_active) {
                              handleToggleActive(setting.id);
                            }
                          }}
                          disabled={setting.is_active}
                          className={`inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md ${
                            setting.is_active 
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                              : 'text-white bg-primary hover:bg-primary/90'
                          }`}
                        >
                          {setting.is_active ? (
                            <><ToggleRight className="h-4 w-4 mr-1" /> Active</>
                          ) : (
                            <><ToggleLeft className="h-4 w-4 mr-1" /> Activate</>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mb-6 flex justify-between">
          <button
            onClick={() => setShowClearModal(true)}
            disabled={clearing}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {clearing ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-5 w-5" />
                Clear Settings
              </>
            )}
          </button>

          <button
            onClick={() => setShowRolloverModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            <Archive className="mr-2 h-5 w-5" />
            Rollover Tech Conference
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-lg p-8">
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h2 className="text-xl font-bold text-secondary mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Conference Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={settings.name}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label htmlFor="fee" className="block text-sm font-medium text-gray-700">
                    Registration Fee ($)
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <DollarSign className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      id="fee"
                      name="fee"
                      value={settings.fee}
                      onChange={handleChange}
                      required
                      min="0"
                      step="0.01"
                      className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div>
              <h2 className="text-xl font-bold text-secondary mb-4">Conference Dates</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
                    Start Date
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      id="start_date"
                      name="start_date"
                      value={settings.start_date}
                      onChange={handleChange}
                      required
                      className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
                    End Date
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      id="end_date"
                      name="end_date"
                      value={settings.end_date}
                      onChange={handleChange}
                      required
                      className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="registration_end_date" className="block text-sm font-medium text-gray-700">
                    Registration Deadline
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Clock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      id="registration_end_date"
                      name="registration_end_date"
                      value={settings.registration_end_date}
                      onChange={handleChange}
                      required
                      className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Location */}
            <div>
              <h2 className="text-xl font-bold text-secondary mb-4">Location Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                    City/State
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPin className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="location"
                      name="location"
                      value={settings.location}
                      onChange={handleChange}
                      required
                      className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                      placeholder="e.g., Nashville, TN"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="venue" className="block text-sm font-medium text-gray-700">
                    Venue Name
                  </label>
                  <input
                    type="text"
                    id="venue"
                    name="venue"
                    value={settings.venue}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    placeholder="e.g., Convention Center"
                  />
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div>
              <h2 className="text-xl font-bold text-secondary mb-4">Additional Information</h2>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Conference Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={settings.description}
                  onChange={handleChange}
                  rows={4}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  placeholder="Describe the conference, its goals, and what attendees can expect..."
                />
              </div>

              <div className="mt-6">
                <label htmlFor="payment_instructions" className="block text-sm font-medium text-gray-700">
                  Payment Instructions
                </label>
                <textarea
                  id="payment_instructions"
                  name="payment_instructions"
                  value={settings.payment_instructions}
                  onChange={handleChange}
                  rows={4}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  placeholder="Provide detailed payment instructions..."
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex justify-center items-center py-3 px-6 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Save Tech Conference Settings
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Rollover Modal */}
        {showRolloverModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Rollover Tech Conference</h2>
              <p className="text-gray-600 mb-6">
                This will archive all current registrations and create a new tech conference period. Are you sure you want to continue?
              </p>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">New Start Date</label>
                  <input
                    type="date"
                    value={settings.start_date}
                    onChange={(e) => setSettings({ ...settings, start_date: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">New End Date</label>
                  <input
                    type="date"
                    value={settings.end_date}
                    onChange={(e) => setSettings({ ...settings, end_date: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">New Registration Deadline</label>
                  <input
                    type="date"
                    value={settings.registration_end_date}
                    onChange={(e) => setSettings({ ...settings, registration_end_date: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowRolloverModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRollover}
                  disabled={isRollingOver}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  {isRollingOver ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Rolling Over...
                    </>
                  ) : (
                    'Confirm Rollover'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmationModal
          isOpen={showClearModal}
          onClose={() => setShowClearModal(false)}
          onConfirm={handleClearTable}
          title="Clear Tech Conference Settings"
          message="Are you sure you want to clear all tech conference settings? This action cannot be undone."
          confirmText="Clear Settings"
          confirmationPhrase="CLEAR SETTINGS"
          isLoading={clearing}
          loadingText="Clearing..."
        />
      </div>
    </AdminLayout>
  );
};

export default AdminTechConferenceSettings;