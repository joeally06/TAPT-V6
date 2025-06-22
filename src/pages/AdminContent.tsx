import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Edit, 
  Calendar,
  FileText,
  Bell,
  Image,
  Save,
  X,
  Upload,
  Star
} from 'lucide-react';
import { NEWS_CATEGORIES } from '../lib/types/news';
import { useAuth } from '../context/AuthContext';
import { uploadFile } from '../lib/upload';
import { getPublicUrl } from '../lib/storage';

interface ContentItem {
  id: string;
  title: string;
  description: string;
  type: 'event' | 'announcement' | 'resource' | 'news';
  status: 'draft' | 'published';
  featured: boolean;
  image_url: string | null;
  date: string | null;
  category: string | null;
  link: string | null;
  is_featured: boolean;
}

interface ResourceItem {
  id: string;
  title: string;
  description: string;
  category: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export const AdminContent: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [selectedType, setSelectedType] = useState<ContentItem['type']>('event');
  const [showForm, setShowForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState<Partial<ContentItem>>({
    title: '',
    description: '',
    type: selectedType,
    status: 'draft',
    featured: false,
    is_featured: false,
    category: null
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
      if (selectedType === 'resource') {
        fetchResources();
      } else {
        fetchContent();
      }
    }
    // eslint-disable-next-line
  }, [authLoading, user, selectedType]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('type', selectedType)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setContentItems(data || []);
    } catch (error: any) {
      console.error('Error fetching content:', error);
      setError('Failed to load content items');
    } finally {
      setLoading(false);
    }
  };

  const fetchResources = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setResources(data || []);
    } catch (error: any) {
      console.error('Error fetching resources:', error);
      setError('Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      if (selectedType === 'resource') {
        // Resource upload logic
        if (!selectedFile) {
          throw new Error('Please select a file to upload');
        }

        if (!formData.category) {
          throw new Error('Please select a category for the resource');
        }

        if (!user?.access_token) {
          throw new Error('User not authenticated');
        }

        // Upload file to Supabase Storage
        const filePath = await uploadFile(
          selectedFile, 
          'resources', 
          user.access_token, 
          { 
            bucket: 'public',
            allowedTypes: [
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'text/plain',
              'text/csv'
            ]
          }
        );

        // Get public URL for the uploaded file
        const fileUrl = getPublicUrl('public', filePath);

        // Insert resource record into database
        const { data: resourceData, error: resourceError } = await supabase
          .from('resources')
          .insert([{
            title: formData.title,
            description: formData.description,
            category: formData.category,
            file_url: fileUrl,
            file_type: selectedFile.type,
            file_size: selectedFile.size,
            created_by: user.id
          }])
          .select()
          .single();

        if (resourceError) throw resourceError;

        setSuccess('Resource uploaded successfully!');
        fetchResources();
      } else {
        let imagePath = formData.image_url;
        if (selectedFile) {
          const fileExt = selectedFile.name.split('.').pop();
          const fileName = `${crypto.randomUUID()}.${fileExt}`;
          const filePath = `content/${fileName}`;
          const { error: uploadError } = await supabase.storage
            .from('public')
            .upload(filePath, selectedFile);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage
            .from('public')
            .getPublicUrl(filePath);
          imagePath = publicUrl;
        }

        // Get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw new Error(`Session error: ${sessionError.message}`);
        }
        
        if (!session || !session.access_token) {
          throw new Error('No active session');
        }
        
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
          throw new Error('VITE_SUPABASE_URL is not defined');
        }
        
        console.log(`Submitting content to: ${supabaseUrl}/functions/v1/admin-content`);
        
        // Use Edge Function for secure content upsert
        const response = await fetch(`${supabaseUrl}/functions/v1/admin-content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            ...formData,
            image_url: imagePath,
            type: selectedType,
            id: editingItem?.id // Pass id for update, undefined for insert
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
          throw new Error(errorData.message || `Request failed with status ${response.status}`);
        }
        
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to save content');
        }
        
        setSuccess(`Content ${editingItem ? 'updated' : 'added'} successfully!`);
        fetchContent();
      }
      setShowForm(false);
      setEditingItem(null);
      setSelectedFile(null);
      setFormData({
        title: '',
        description: '',
        type: selectedType,
        status: 'draft',
        featured: false,
        is_featured: false,
        category: selectedType === 'news' ? NEWS_CATEGORIES[1].id : null
      });
    } catch (error: any) {
      console.error('Error saving content:', error);
      setError(`Error saving content: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Session error: ${sessionError.message}`);
      }
      
      if (!session || !session.access_token) {
        throw new Error('No active session');
      }
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined');
      }
      
      if (selectedType === 'resource') {
        // Use Edge Function for secure resource deletion
        const response = await fetch(`${supabaseUrl}/functions/v1/admin-resource`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ id })
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
          throw new Error(errorData.message || `Request failed with status ${response.status}`);
        }
        setSuccess('Resource deleted successfully!');
        fetchResources();
      } else {
        // Use Edge Function for secure content deletion
        const response = await fetch(`${supabaseUrl}/functions/v1/admin-content`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ id })
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
          throw new Error(errorData.message || `Request failed with status ${response.status}`);
        }
        setSuccess('Content deleted successfully!');
        fetchContent();
      }
    } catch (error: any) {
      console.error('Error deleting item:', error);
      setError(`Failed to delete item: ${error.message}`);
    }
  };

  const handleEdit = (item: ContentItem) => {
    setEditingItem(item);
    setFormData(item);
    setShowForm(true);
  };

  const contentTypes = [
    { id: 'event', label: 'Events', icon: Calendar },
    { id: 'announcement', label: 'Announcements', icon: Bell },
    { id: 'resource', label: 'Resources', icon: FileText },
    { id: 'news', label: 'News', icon: FileText }
  ] as const;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="pt-16">
      {/* Hero Section */}
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
            <h1 className="text-3xl font-bold">Content Management</h1>
          </div>
          <p className="mt-2">Manage website content, featured items, and resources</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4">
            <p className="text-green-700">{success}</p>
          </div>
        )}

        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {contentTypes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSelectedType(id)}
                className={`
                  flex items-center pb-4 px-1 border-b-2 font-medium text-sm
                  ${selectedType === id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                <Icon className="h-5 w-5 mr-2" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mb-6">
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({
                title: '',
                description: '',
                type: selectedType,
                status: 'draft',
                featured: false,
                is_featured: false,
                category: selectedType === 'news' ? NEWS_CATEGORIES[1].id : null
              });
              setShowForm(!showForm);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add New {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}
          </button>
        </div>

        {showForm && (
          <div className="mb-8 bg-white shadow-md rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-secondary">
                {editingItem ? `Edit ${selectedType}` : `Add New ${selectedType}`}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                />
              </div>

              {selectedType === 'resource' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Category
                    </label>
                    <select
                      value={formData.category || ''}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                    >
                      <option value="">Select Category</option>
                      <option value="manuals">Manuals & Guides</option>
                      <option value="forms">Forms & Documents</option>
                      <option value="laws">Laws & Regulations</option>
                      <option value="training">Training Materials</option>
                      <option value="safety">Safety Resources</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      File
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      required={!editingItem}
                      className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    />
                    {selectedFile && (
                      <p className="mt-2 text-sm text-gray-500">
                        Selected file: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {selectedType === 'news' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Category
                      </label>
                      <select
                        value={formData.category || ''}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                      >
                        <option value="">Select Category</option>
                        {NEWS_CATEGORIES.slice(1).map(category => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Image
                    </label>
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      accept="image/*"
                      className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    />
                  </div>

                  {selectedType === 'event' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Date
                        </label>
                        <input
                          type="date"
                          value={formData.date || ''}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Link (Optional)
                        </label>
                        <input
                          type="url"
                          value={formData.link || ''}
                          onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'draft' | 'published' })}
                        className="mt-1 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                      </select>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="featured"
                        checked={formData.featured}
                        onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <label htmlFor="featured" className="ml-2 block text-sm text-gray-700">
                        Featured
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_featured"
                        checked={formData.is_featured}
                        onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <label htmlFor="is_featured" className="ml-2 block text-sm text-gray-700">
                        Featured Event
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-5 w-5 inline-block" />
                      {editingItem ? 'Update' : 'Save'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
              <p className="mt-2 text-gray-600">Loading content...</p>
            </div>
          ) : selectedType === 'resource' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Added
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {resources.map((resource) => (
                    <tr key={resource.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{resource.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{resource.category}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{resource.file_type.toUpperCase()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{formatFileSize(resource.file_size)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {new Date(resource.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDelete(resource.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    {selectedType === 'news' && (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                    )}
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Featured
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {contentItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {item.image_url && (
                            <img
                              src={item.image_url}
                              alt={item.title}
                              className="h-10 w-10 rounded-full object-cover mr-3"
                            />
                          )}
                          <div className="text-sm font-medium text-gray-900">{item.title}</div>
                        </div>
                      </td>
                      {selectedType === 'news' && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {NEWS_CATEGORIES.find(cat => cat.id === item.category)?.name || item.category}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          item.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          {item.featured && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              Featured
                            </span>
                          )}
                          {item.is_featured && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                              Featured Event
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.date ? new Date(item.date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-primary hover:text-primary/80 mr-3"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminContent;