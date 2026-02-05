import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Clock, Save, AlertCircle, Trash2, Archive, ToggleLeft, ToggleRight } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../components/AdminLayout';

interface HallOfFameSettings {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  description: string;
  nomination_instructions: string;
  eligibility_criteria: string;
  is_active: boolean;
  // Dynamic year configuration
  conference_year_1: number;
  conference_year_2: number;
  conference_year_3: number;
  award_year: number;
}

export const AdminHallOfFameSettings: React.FC = () => {
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
  const [allSettings, setAllSettings] = useState<HallOfFameSettings[]>([]);
  
  const [settings, setSettings] = useState<HallOfFameSettings>({
    id: '',
    name: '',
    start_date: '',
    end_date: '',
    description: '',
    nomination_instructions: '',
    eligibility_criteria: '',
    is_active: true,
    // Default to next year cycle (current year - 3 through current year - 1 for attendance, current year for award)
    conference_year_1: new Date().getFullYear() - 3,
    conference_year_2: new Date().getFullYear() - 2,
    conference_year_3: new Date().getFullYear() - 1,
    award_year: new Date().getFullYear()
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
        .from('hall_of_fame_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (allError) throw allError;
      setAllSettings(allData || []);

      // Fetch active setting
      const { data, error } = await supabase
        .from('hall_of_fame_settings')
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
          // Ensure year fields have defaults if not set in database
          conference_year_1: data.conference_year_1 ?? new Date().getFullYear() - 3,
          conference_year_2: data.conference_year_2 ?? new Date().getFullYear() - 2,
          conference_year_3: data.conference_year_3 ?? new Date().getFullYear() - 1,
          award_year: data.award_year ?? new Date().getFullYear()
        });
      }
    } catch (error: any) {
      setError(`Failed to load hall of fame settings: ${error.message}`);
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
    
    // Handle number inputs for year fields
    if (type === 'number') {
      setSettings(prev => ({
        ...prev,
        [name]: parseInt(value, 10) || 0
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        [name]: value
      }));
    }
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

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-hof-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({ 
          ...settings, 
          id: settings.id.trim() === '' ? await fetchUUID() : settings.id,
          updated_at: new Date().toISOString() 
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save hall of fame settings');
      }
      setSuccess('Hall of Fame settings saved successfully!');
      await fetchSettings();
    } catch (error: any) {
      setError(`Failed to save hall of fame settings: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearTable = async () => {
    setClearing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-hof-settings`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({ clear: true })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear hall of fame settings');
      }
      setSuccess('Hall of Fame settings cleared successfully!');
      const uuid = await fetchUUID();
      setSettings({
        id: uuid,
        name: '',
        start_date: '',
        end_date: '',
        description: '',
        nomination_instructions: '',
        eligibility_criteria: '',
        is_active: true,
        conference_year_1: new Date().getFullYear() - 3,
        conference_year_2: new Date().getFullYear() - 2,
        conference_year_3: new Date().getFullYear() - 1,
        award_year: new Date().getFullYear()
      });
    } catch (error: any) {
      setError(`Failed to clear hall of fame settings: ${error.message}`);
    } finally {
      setClearing(false);
      setShowClearModal(false);
    }
  };

  const handleRollover = async () => {
    try {
      setIsRollingOver(true);
      setError(null);

      // Validate Supabase URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined in the environment');
      }

      try {
        new URL(supabaseUrl);
      } catch (e) {
        throw new Error('VITE_SUPABASE_URL is invalid');
      }

      // Validate dates
      if (!settings.start_date || !settings.end_date) {
        throw new Error('Please set all required dates before rolling over');
      }

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Prepare new settings
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
      };

      // Call rollover function
      const response = await fetch(
        `${supabaseUrl}/functions/v1/rollover`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'hall-of-fame',
            settings: newSettings,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to rollover hall of fame: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to rollover hall of fame');
      }

      setSuccess('Hall of Fame rolled over successfully! Previous nominations have been archived.');
      await fetchSettings();
    } catch (error: any) {
      setError(`Failed to rollover hall of fame: ${error.message}`);
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
        .from('hall_of_fame_settings')
        .update({ is_active: false })
        .neq('id', 'no-match'); // Update all records

      if (deactivateError) throw deactivateError;

      // Then activate the selected setting
      const { error: activateError } = await supabase
        .from('hall_of_fame_settings')
        .update({ is_active: true })
        .eq('id', settingId);

      if (activateError) throw activateError;

      setSuccess('Active Hall of Fame setting updated successfully!');
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
          <h1 className="text-3xl font-bold text-gray-900">Hall of Fame Settings</h1>
          <p className="mt-1 text-gray-600">Manage Hall of Fame nomination period and requirements</p>
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

        {/* Available Hall of Fame Settings */}
        {allSettings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-secondary mb-4">Available Hall of Fame Settings</h2>
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nomination Period
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
            Rollover Hall of Fame
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-lg p-8">
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h2 className="text-xl font-bold text-secondary mb-4">Basic Information</h2>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Hall of Fame Year/Title
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={settings.name}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  placeholder="e.g., 2024 Hall of Fame"
                />
              </div>
            </div>

            {/* Nomination Period */}
            <div>
              <h2 className="text-xl font-bold text-secondary mb-4">Nomination Period</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
                    Start Date
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Clock className="h-5 w-5 text-gray-400" />
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
                      <Clock className="h-5 w-5 text-gray-400" />
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
              </div>
            </div>

            {/* Form Year Configuration */}
            <div>
              <h2 className="text-xl font-bold text-secondary mb-4">Form Year Configuration</h2>
              <p className="text-sm text-gray-600 mb-4">
                Configure the years displayed in the nomination form. Districts must have attended the TAPT conference 
                in all three specified years to be eligible.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Conference Attendance Years</h3>
                <p className="text-xs text-blue-700 mb-3">
                  These three years appear in the nomination form under "Our district attended the TAPT conference in:"
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="conference_year_1" className="block text-sm font-medium text-gray-700">
                      Year 1
                    </label>
                    <input
                      type="number"
                      id="conference_year_1"
                      name="conference_year_1"
                      value={settings.conference_year_1}
                      onChange={handleChange}
                      required
                      min="2000"
                      max="2100"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="conference_year_2" className="block text-sm font-medium text-gray-700">
                      Year 2
                    </label>
                    <input
                      type="number"
                      id="conference_year_2"
                      name="conference_year_2"
                      value={settings.conference_year_2}
                      onChange={handleChange}
                      required
                      min="2000"
                      max="2100"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="conference_year_3" className="block text-sm font-medium text-gray-700">
                      Year 3
                    </label>
                    <input
                      type="number"
                      id="conference_year_3"
                      name="conference_year_3"
                      value={settings.conference_year_3}
                      onChange={handleChange}
                      required
                      min="2000"
                      max="2100"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-amber-800 mb-2">Award Ceremony Year</h3>
                <p className="text-xs text-amber-700 mb-3">
                  This year appears in the acknowledgment: "The winner must attend the [year] TAPT Annual Conference"
                </p>
                <div className="max-w-xs">
                  <label htmlFor="award_year" className="block text-sm font-medium text-gray-700">
                    Award Year
                  </label>
                  <input
                    type="number"
                    id="award_year"
                    name="award_year"
                    value={settings.award_year}
                    onChange={handleChange}
                    required
                    min="2000"
                    max="2100"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  />
                </div>
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
                    Save Hall of Fame Settings
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
              <h2 className="text-xl font-bold text-gray-900 mb-4">Rollover Hall of Fame</h2>
              <p className="text-gray-600 mb-6">
                This will archive all current nominations and create a new nomination period. Are you sure you want to continue?
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
          title="Clear Hall of Fame Settings"
          message="Are you sure you want to clear all hall of fame settings? This action cannot be undone."
          confirmText="Clear Settings"
          confirmationPhrase="CLEAR SETTINGS"
          isLoading={clearing}
          loadingText="Clearing..."
        />
      </div>
    </AdminLayout>
  );
};

export default AdminHallOfFameSettings;