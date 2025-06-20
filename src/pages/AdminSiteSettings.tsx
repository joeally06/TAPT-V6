import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Upload, X, Image, AlertCircle, CheckCircle, Mail, Phone, Globe, Type } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getSiteSetting, updateSiteSetting } from '../lib/siteSettings';
import AdminLayout from '../components/AdminLayout';

interface SiteSettingsState {
  heroImageUrl: string;
  siteTitle: string;
  siteTagline: string;
  contactEmail: string;
  contactPhone: string;
  socialFacebook: string;
  socialTwitter: string;
  socialInstagram: string;
  footerText: string;
  aboutText: string;
}

export const AdminSiteSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState<SiteSettingsState>({
    heroImageUrl: '',
    siteTitle: '',
    siteTagline: '',
    contactEmail: '',
    contactPhone: '',
    socialFacebook: '',
    socialTwitter: '',
    socialInstagram: '',
    footerText: '',
    aboutText: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('general');

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
      const heroImageUrl = await getSiteSetting('hero_image_url');
      const siteTitle = await getSiteSetting('site_title');
      const siteTagline = await getSiteSetting('site_tagline');
      const contactEmail = await getSiteSetting('contact_email');
      const contactPhone = await getSiteSetting('contact_phone');
      const socialFacebook = await getSiteSetting('social_facebook');
      const socialTwitter = await getSiteSetting('social_twitter');
      const socialInstagram = await getSiteSetting('social_instagram');
      const footerText = await getSiteSetting('footer_text');
      const aboutText = await getSiteSetting('about_text');
      
      setSettings({
        heroImageUrl: heroImageUrl || '',
        siteTitle: siteTitle || 'Tennessee Association of Pupil Transportation',
        siteTagline: siteTagline || 'Promoting safe and efficient student transportation across Tennessee',
        contactEmail: contactEmail || 'contact@tapt.org',
        contactPhone: contactPhone || '615-406-9199',
        socialFacebook: socialFacebook || '',
        socialTwitter: socialTwitter || '',
        socialInstagram: socialInstagram || '',
        footerText: footerText || '',
        aboutText: aboutText || ''
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
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
      
      // Update all settings
      const updates = [
        updateSiteSetting('hero_image_url', imageUrl),
        updateSiteSetting('site_title', settings.siteTitle),
        updateSiteSetting('site_tagline', settings.siteTagline),
        updateSiteSetting('contact_email', settings.contactEmail),
        updateSiteSetting('contact_phone', settings.contactPhone),
        updateSiteSetting('social_facebook', settings.socialFacebook),
        updateSiteSetting('social_twitter', settings.socialTwitter),
        updateSiteSetting('social_instagram', settings.socialInstagram),
        updateSiteSetting('footer_text', settings.footerText),
        updateSiteSetting('about_text', settings.aboutText)
      ];
      
      await Promise.all(updates);
      
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

      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-4 px-6 text-sm font-medium ${
                activeTab === 'general'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Type className="h-5 w-5 inline-block mr-2" />
              General
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`py-4 px-6 text-sm font-medium ${
                activeTab === 'appearance'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Image className="h-5 w-5 inline-block mr-2" />
              Appearance
            </button>
            <button
              onClick={() => setActiveTab('contact')}
              className={`py-4 px-6 text-sm font-medium ${
                activeTab === 'contact'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Mail className="h-5 w-5 inline-block mr-2" />
              Contact
            </button>
            <button
              onClick={() => setActiveTab('social')}
              className={`py-4 px-6 text-sm font-medium ${
                activeTab === 'social'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Globe className="h-5 w-5 inline-block mr-2" />
              Social Media
            </button>
          </nav>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-secondary mb-6">General Information</h2>
              
              <div>
                <label htmlFor="siteTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  Site Title
                </label>
                <input
                  type="text"
                  id="siteTitle"
                  name="siteTitle"
                  value={settings.siteTitle}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                />
                <p className="mt-1 text-sm text-gray-500">
                  The main title of your website, displayed in various locations.
                </p>
              </div>
              
              <div>
                <label htmlFor="siteTagline" className="block text-sm font-medium text-gray-700 mb-1">
                  Site Tagline
                </label>
                <input
                  type="text"
                  id="siteTagline"
                  name="siteTagline"
                  value={settings.siteTagline}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                />
                <p className="mt-1 text-sm text-gray-500">
                  A short description of your organization, displayed on the homepage.
                </p>
              </div>
              
              <div>
                <label htmlFor="footerText" className="block text-sm font-medium text-gray-700 mb-1">
                  Footer Text
                </label>
                <textarea
                  id="footerText"
                  name="footerText"
                  value={settings.footerText}
                  onChange={handleChange}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  placeholder="Optional footer text or copyright information"
                />
              </div>
              
              <div>
                <label htmlFor="aboutText" className="block text-sm font-medium text-gray-700 mb-1">
                  About Text
                </label>
                <textarea
                  id="aboutText"
                  name="aboutText"
                  value={settings.aboutText}
                  onChange={handleChange}
                  rows={5}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  placeholder="Brief description about your organization"
                />
                <p className="mt-1 text-sm text-gray-500">
                  This text may be displayed on the About page or in other locations.
                </p>
              </div>
            </div>
          )}
          
          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
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
          )}
          
          {/* Contact Settings */}
          {activeTab === 'contact' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-secondary mb-6">Contact Information</h2>
              
              <div>
                <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    id="contactEmail"
                    name="contactEmail"
                    value={settings.contactEmail}
                    onChange={handleChange}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Primary contact email displayed on the website.
                </p>
              </div>
              
              <div>
                <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Phone
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="contactPhone"
                    name="contactPhone"
                    value={settings.contactPhone}
                    onChange={handleChange}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Primary contact phone number displayed on the website.
                </p>
              </div>
            </div>
          )}
          
          {/* Social Media Settings */}
          {activeTab === 'social' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-secondary mb-6">Social Media Links</h2>
              
              <div>
                <label htmlFor="socialFacebook" className="block text-sm font-medium text-gray-700 mb-1">
                  Facebook URL
                </label>
                <input
                  type="url"
                  id="socialFacebook"
                  name="socialFacebook"
                  value={settings.socialFacebook}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  placeholder="https://facebook.com/yourpage"
                />
              </div>
              
              <div>
                <label htmlFor="socialTwitter" className="block text-sm font-medium text-gray-700 mb-1">
                  Twitter URL
                </label>
                <input
                  type="url"
                  id="socialTwitter"
                  name="socialTwitter"
                  value={settings.socialTwitter}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  placeholder="https://twitter.com/yourhandle"
                />
              </div>
              
              <div>
                <label htmlFor="socialInstagram" className="block text-sm font-medium text-gray-700 mb-1">
                  Instagram URL
                </label>
                <input
                  type="url"
                  id="socialInstagram"
                  name="socialInstagram"
                  value={settings.socialInstagram}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  placeholder="https://instagram.com/yourprofile"
                />
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-gray-200 mt-8">
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