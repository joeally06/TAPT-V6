import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Save, AlertCircle, ArrowLeft, Trash2, Archive, ToggleLeft, ToggleRight, FileText } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';

interface ScholarshipSettings {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  application_deadline: string;
  description: string;
  eligibility_criteria: string;
  instructions: string;
  is_active: boolean;
}

const AdminStudentScholarshipSettings: React.FC = () => {
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
  const [allSettings, setAllSettings] = useState<ScholarshipSettings[]>([]);
  
  const [settings, setSettings] = useState<ScholarshipSettings>({
    id: '',
    name: '2025 TAPT Scholarship Application Form',
    start_date: '',
    end_date: '',
    application_deadline: '',
    description: 'TAPT offers scholarships to eligible students pursuing higher education in transportation-related fields.',
    eligibility_criteria: 'Applicants must be high school seniors or current college students with less than 32 credit hours, planning to pursue a degree in a transportation-related field.',
    instructions: 'Complete all required fields. Winners will be notified on or before April 30, 2025. Scholarship payments will be made directly to the institution upon proper confirmation of student enrollment.',
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
        .from('student_scholarship_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (allError) throw allError;
      setAllSettings(allData || []);

      // Fetch active setting
      const { data, error } = await supabase
        .from('student_scholarship_settings')
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
          application_deadline: data.application_deadline.split('T')[0]
        });
      }
    } catch (error: any) {
      setError(`Failed to load scholarship settings: ${error.message}`);
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
    const { name, value } = e.target;
    
    setSettings(prev => ({
      ...prev,
      [name]: value
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

      // Use Edge Function for upsert (add/update)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-student-scholarship-settings`, {
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
        throw new Error(errorData.error || 'Failed to save scholarship settings');
      }
      setSuccess('Scholarship settings saved successfully!');
      await fetchSettings();
    } catch (error: any) {
      setError(`Failed to save scholarship settings: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearTable = async () => {
    setClearing(true);
    setError(null);
    setSuccess(null);

    try {
      // Use Edge Function for delete/clear
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-student-scholarship-settings`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({ clear: true })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear scholarship settings');
      }
      setSuccess('Scholarship settings cleared successfully!');
      const uuid = await fetchUUID();
      setSettings({
        id: uuid,
        name: '2025 TAPT Scholarship Application Form',
        start_date: '',
        end_date: '',
        application_deadline: '',
        description: 'TAPT offers scholarships to eligible students pursuing higher education in transportation-related fields.',
        eligibility_criteria: 'Applicants must be high school seniors or current college students with less than 32 credit hours, planning to pursue a degree in a transportation-related field.',
        instructions: 'Complete all required fields. Winners will be notified on or before April 30, 2025. Scholarship payments will be made directly to the institution upon proper confirmation of student enrollment.',
        is_active: true
      });
    } catch (error: any) {
      setError(`Failed to clear scholarship settings: ${error.message}`);
    } finally {
      setClearing(false);
      setShowClearModal(false);
    }
  };

  const handleRollover = async () => {
    try {
      setIsRollingOver(true);
      setError(null);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined in the environment');
      }

      try {
        new URL(supabaseUrl);
      } catch (e) {
        throw new Error('VITE_SUPABASE_URL is invalid');
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      
      if (!session || !session.access_token) {
        throw new Error('No active session or access token is missing');
      }

      if (!settings.start_date || !settings.end_date || !settings.application_deadline) {
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
        application_deadline: settings.application_deadline,
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
            type: 'student-scholarship',
            settings: newSettings,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to rollover scholarship: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to rollover scholarship');
      }

      setSuccess('Scholarship settings rolled over successfully! Previous applications have been archived.');
      await fetchSettings();
    } catch (error: any) {
      setError(`Failed to rollover scholarship: ${error.message}`);
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
        .from('student_scholarship_settings')
        .update({ is_active: false })
        .neq('id', 'no-match'); // Update all records

      if (deactivateError) throw deactivateError;

      // Then activate the selected setting
      const { error: activateError } = await supabase
        .from('student_scholarship_settings')
        .update({ is_active: true })
        .eq('id', settingId);

      if (activateError) throw activateError;

      setSuccess('Active scholarship setting updated successfully!');
      await fetchSettings();
    } catch (error: any) {
      setError(`Failed to update active setting: ${error.message}`);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="pt-16">
      <section className="bg-secondary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate('/admin')}
              className="inline-flex items-center text-white hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="h-6 w-6 mr-2" />
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold">Student Scholarship Settings</h1>
          </div>
          <p className="mt-2">Manage scholarship application period and requirements</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        {/* Available Scholarship Settings */}
        {allSettings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-secondary mb-4">Available Scholarship Settings</h2>
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Application Period
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deadline
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
                          {new Date(setting.start_date).toLocaleDateString()} - {new Date(setting.end_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {new Date(setting.application_deadline).toLocaleDateString()}
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
            Rollover Scholarship
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-lg p-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-secondary mb-4">Basic Information</h2>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Scholarship Name
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
            </div>

            <div>
              <h2 className="text-xl font-bold text-secondary mb-4">Application Period</h2>
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
                  <label htmlFor="application_deadline" className="block text-sm font-medium text-gray-700">
                    Application Deadline
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      id="application_deadline"
                      name="application_deadline"
                      value={settings.application_deadline}
                      onChange={handleChange}
                      required
                      className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-secondary mb-4">Scholarship Details</h2>
              
              <div className="mb-6">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={settings.description}
                  onChange={handleChange}
                  rows={4}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  placeholder="Describe the scholarship program, its purpose, and benefits..."
                />
              </div>

              <div className="mb-6">
                <label htmlFor="eligibility_criteria" className="block text-sm font-medium text-gray-700">
                  Eligibility Criteria
                </label>
                <textarea
                  id="eligibility_criteria"
                  name="eligibility_criteria"
                  value={settings.eligibility_criteria}
                  onChange={handleChange}
                  rows={4}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  placeholder="Specify who is eligible to apply for this scholarship..."
                />
              </div>

              <div>
                <label htmlFor="instructions" className="block text-sm font-medium text-gray-700">
                  Application Instructions
                </label>
                <textarea
                  id="instructions"
                  name="instructions"
                  value={settings.instructions}
                  onChange={handleChange}
                  rows={4}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  placeholder="Provide detailed instructions for applicants..."
                />
              </div>
            </div>

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
                    Save Scholarship Settings
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
              <h2 className="text-xl font-bold text-gray-900 mb-4">Rollover Scholarship</h2>
              <p className="text-gray-600 mb-6">
                This will archive all current applications and create a new scholarship period. Are you sure you want to continue?
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
                  <label className="block text-sm font-medium text-gray-700">New Application Deadline</label>
                  <input
                    type="date"
                    value={settings.application_deadline}
                    onChange={(e) => setSettings({ ...settings, application_deadline: e.target.value })}
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
          title="Clear Scholarship Settings"
          message="Are you sure you want to clear all scholarship settings? This action cannot be undone."
          confirmText="Clear Settings"
          confirmationPhrase="CLEAR SETTINGS"
          isLoading={clearing}
          loadingText="Clearing..."
        />
      </div>
    </div>
  );
};

export default AdminStudentScholarshipSettings;