import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Clock, Save, AlertCircle, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../components/AdminLayout';

interface PresidentSettings {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  description: string;
  nomination_instructions: string;
  term_label: string;
  term_duration: string;
  is_active: boolean;
}

export const AdminPresidentNominationSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [allSettings, setAllSettings] = useState<PresidentSettings[]>([]);
  
  const [settings, setSettings] = useState<PresidentSettings>({
    id: '',
    name: '',
    start_date: '',
    end_date: '',
    description: '',
    nomination_instructions: '',
    term_label: '26-27',
    term_duration: '3',
    is_active: true,
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

      const { data: allData, error: allError } = await supabase
        .from('president_nomination_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (allError) throw allError;
      setAllSettings(allData || []);

      const { data, error } = await supabase
        .from('president_nomination_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          ...data,
          start_date: data.start_date.split('T')[0],
          end_date: data.end_date.split('T')[0],
        });
      }
    } catch (error: any) {
      setError(`Failed to load settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchUUID = async (): Promise<string> => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is not defined');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-uuid`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!response.ok) throw new Error('Failed to generate UUID');
      const { uuid } = await response.json();
      return uuid;
    } catch (error: any) {
      console.error('Error fetching UUID:', error);
      throw error;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (!settings.id || settings.id.trim() === '') {
        const uuid = await fetchUUID();
        setSettings(prev => ({ ...prev, id: uuid }));
        settings.id = uuid;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-president-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({ 
          ...settings,
          updated_at: new Date().toISOString() 
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }
      setSuccess('President nomination settings saved successfully!');
      await fetchSettings();
    } catch (error: any) {
      setError(`Failed to save settings: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearTable = async () => {
    setClearing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-president-settings`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({ clear: true })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear settings');
      }
      setSuccess('Settings cleared successfully!');
      const uuid = await fetchUUID();
      setSettings({
        id: uuid,
        name: '',
        start_date: '',
        end_date: '',
        description: '',
        nomination_instructions: '',
        term_label: '26-27',
        term_duration: '3',
        is_active: true,
      });
      setAllSettings([]);
    } catch (error: any) {
      setError(`Failed to clear settings: ${error.message}`);
    } finally {
      setClearing(false);
      setShowClearModal(false);
    }
  };

  const handleToggleActive = async (settingId: string) => {
    try {
      setError(null);
      setSuccess(null);

      const { error: deactivateError } = await supabase
        .from('president_nomination_settings')
        .update({ is_active: false })
        .neq('id', 'no-match');

      if (deactivateError) throw deactivateError;

      const { error: activateError } = await supabase
        .from('president_nomination_settings')
        .update({ is_active: true })
        .eq('id', settingId);

      if (activateError) throw activateError;

      setSuccess('Active setting updated successfully!');
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">President Nomination Settings</h1>
          <p className="mt-1 text-gray-600">Manage TAPT President nomination period</p>
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

        {/* Available Settings Table */}
        {allSettings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-secondary mb-4">Available Settings</h2>
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Term</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nomination Period</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allSettings.map((setting) => (
                    <tr key={setting.id} className={setting.is_active ? "bg-green-50" : ""}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{setting.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{setting.term_label}</div>
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
                          onClick={() => { if (!setting.is_active) handleToggleActive(setting.id); }}
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

        <div className="mb-6 flex justify-start">
          <button
            onClick={() => setShowClearModal(true)}
            disabled={clearing}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            <Trash2 className="mr-2 h-5 w-5" />
            {clearing ? 'Clearing...' : 'Clear Settings'}
          </button>
        </div>

        {/* Settings Form */}
        <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-lg p-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-secondary mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Nomination Period Title
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={settings.name}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    placeholder="e.g., 2026-2027 President Nominations"
                  />
                </div>
                <div>
                  <label htmlFor="term_label" className="block text-sm font-medium text-gray-700">
                    Term Label
                  </label>
                  <input
                    type="text"
                    id="term_label"
                    name="term_label"
                    value={settings.term_label}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    placeholder="e.g., 26-27"
                  />
                </div>
              </div>
              <div className="mt-6">
                <label htmlFor="term_duration" className="block text-sm font-medium text-gray-700">
                  Term Duration (years)
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    id="term_duration"
                    name="term_duration"
                    value={settings.term_duration}
                    onChange={handleChange}
                    required
                    min="1"
                    max="10"
                    className="block w-24 border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    placeholder="3"
                  />
                  <span className="text-sm text-gray-600">year(s)</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">This appears on the form as: "The President will serve a {settings.term_duration} year term"</p>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-secondary mb-4">Nomination Period</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">Start Date</label>
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
                  <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">End Date</label>
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

            <div>
              <h2 className="text-xl font-bold text-secondary mb-4">Description & Instructions</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    value={settings.description || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    placeholder="Description shown on the nomination form"
                  />
                </div>
                <div>
                  <label htmlFor="nomination_instructions" className="block text-sm font-medium text-gray-700">Nomination Instructions</label>
                  <textarea
                    id="nomination_instructions"
                    name="nomination_instructions"
                    rows={3}
                    value={settings.nomination_instructions || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    placeholder="Instructions for nominators"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
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
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Clear Confirmation Modal */}
        <ConfirmationModal
          isOpen={showClearModal}
          onClose={() => setShowClearModal(false)}
          onConfirm={handleClearTable}
          title="Clear Settings"
          message="Are you sure you want to clear all President nomination settings? This action cannot be undone."
          confirmText="Clear Settings"
          cancelText="Cancel"
          variant="danger"
        />
      </div>
    </AdminLayout>
  );
};

export default AdminPresidentNominationSettings;
