import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Upload, X, Image, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getSiteSetting, updateSiteSetting } from '../lib/siteSettings';
import AdminLayout from '../components/AdminLayout';

interface SiteSettingsState {
  heroImageUrl: string;
}

export const AdminSiteSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState<SiteSettingsState>({
    heroImageUrl: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

      // Fetch hero image URL
      const heroImageUrl = await getSiteSetting('hero_image_url');
      
      setSettings({
        heroImageUrl: heroImageUrl || ''
      });
    } catch (error: any) {
      console.error('Error fetching site settings:', error);
      setError('Failed to load site settings');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      setSelectedFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return null;
    
    try {
      // Get file extension
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `hero-image-${Date.now()}.${fileExt}`;
      const filePath = `site-settings/${fileName}`;
      
      // Upload to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from('public')
        .upload(filePath, selectedFile);
        
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);
        
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    
    try {
      let imageUrl = settings.heroImageUrl;
      
      // If a new file is selected, upload it
      if (selectedFile) {
        imageUrl = await handleUpload();
        if (!imageUrl) throw new Error('Failed to upload image');
      }
      
      // Update hero image URL in site settings
      await updateSiteSetting('hero_image_url', imageUrl);
      
      setSettings(prev => ({
        ...prev,
        heroImageUrl: imageUrl
      }));
      
      setSuccess('Site settings updated successfully!');
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error: any) {
      console.error('Error saving site settings:', error);
      setError(`Failed to save site settings: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Site Settings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage site-wide settings and appearance
          </p>
        </div>
        <button
          onClick={() => navigate('/admin')}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Dashboard
        </button>
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
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-lg rounded-lg p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <h2 className="text-xl font-bold text-secondary mb-6">Hero Image</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Hero Image
              </label>
              <div className="mt-2 relative rounded-lg overflow-hidden bg-gray-100 w-full h-64">
                <img 
                  src={previewUrl || settings.heroImageUrl} 
                  alt="Hero" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload New Hero Image
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />
              <div className="mt-1 flex items-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Choose Image
                </button>
                {selectedFile && (
                  <div className="ml-4 flex items-center">
                    <span className="text-sm text-gray-500">{selectedFile.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="ml-2 text-gray-400 hover:text-gray-500"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Recommended size: 1920x1080 pixels. JPG, PNG, or WebP format.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  fetchSettings();
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 mr-3"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
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
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default AdminSiteSettings;