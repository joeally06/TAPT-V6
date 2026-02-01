import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
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
  Star,
  Link as LinkIcon
} from 'lucide-react';
import { NEWS_CATEGORIES } from '../lib/types/news';
import { useAuth } from '../context/AuthContext';
import { uploadFile } from '../lib/upload';
import { getPublicUrl } from '../lib/storage';
import AdminLayout from '../components/AdminLayout';

interface ContentItem {
  id: string;
  title: string;
  description: string;
  type: 'event' | 'announcement' | 'resource' | 'news';
  status: 'draft' | 'published';
  featured: boolean;
  image_url: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  date: string | null;
  category: string | null;
  link: string | null;
  is_featured: boolean;
  linked_form_type: 'conference' | 'tech-conference' | 'regional-luncheon' | 'hall-of-fame' | 'student-scholarship' | 'exhibitor' | null;
}

// Allowed file types for announcements (documents + images)
const ANNOUNCEMENT_ALLOWED_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

// File extensions for the accept attribute
const ANNOUNCEMENT_ACCEPT_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.webp';

// Helper to determine if a file is an image
const isImageFile = (mimeType: string | null): boolean => {
  if (!mimeType) return false;
  return mimeType.startsWith('image/');
};

// Helper to get file type display name
const getFileTypeDisplay = (mimeType: string | null): string => {
  if (!mimeType) return 'Unknown';
  const typeMap: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'Word',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/vnd.ms-excel': 'Excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
    'text/plain': 'Text',
    'image/jpeg': 'Image',
    'image/png': 'Image',
    'image/gif': 'Image',
    'image/webp': 'Image',
  };
  return typeMap[mimeType] || mimeType.split('/')[1]?.toUpperCase() || 'File';
};

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

// Type-safe visibility options for content publishing
type HomepageVisibility = 'draft' | 'published' | 'featured';

const VISIBILITY_OPTIONS: { value: HomepageVisibility; label: string; description: string }[] = [
  { value: 'draft', label: 'Hidden (Draft)', description: 'Not visible to public' },
  { value: 'published', label: 'Published', description: 'Live but not featured on homepage' },
  { value: 'featured', label: 'Featured on Homepage', description: 'Prominently displayed on homepage' },
];

// Helper to derive visibility from content item flags
const getVisibilityFromItem = (item: Partial<ContentItem>): HomepageVisibility => {
  if (item.status === 'draft') return 'draft';
  if (item.is_featured || item.featured) return 'featured';
  return 'published';
};

// Helper to convert visibility back to database flags (maintains backwards compatibility)
const getItemFlagsFromVisibility = (visibility: HomepageVisibility): Pick<ContentItem, 'status' | 'featured' | 'is_featured'> => {
  switch (visibility) {
    case 'draft':
      return { status: 'draft', featured: false, is_featured: false };
    case 'published':
      return { status: 'published', featured: false, is_featured: false };
    case 'featured':
      return { status: 'published', featured: true, is_featured: true };
    default:
      // Exhaustive check for type safety
      const _exhaustive: never = visibility;
      return { status: 'draft', featured: false, is_featured: false };
  }
};

// Get badge styling based on visibility
const getVisibilityBadge = (item: ContentItem): { label: string; className: string } => {
  const visibility = getVisibilityFromItem(item);
  switch (visibility) {
    case 'draft':
      return { label: 'Draft', className: 'bg-gray-100 text-gray-800' };
    case 'published':
      return { label: 'Published', className: 'bg-green-100 text-green-800' };
    case 'featured':
      return { label: 'Featured', className: 'bg-yellow-100 text-yellow-800' };
  }
};

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
    category: null,
    linked_form_type: null
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
        let fileUrl = formData.file_url;
        let fileType = formData.file_type;
        let fileSize = formData.file_size;
        
        if (selectedFile) {
          // Validate file type for announcements
          if (selectedType === 'announcement' && !ANNOUNCEMENT_ALLOWED_TYPES.includes(selectedFile.type)) {
            throw new Error(`Invalid file type. Allowed types: PDF, Word, Excel, Text, and Images`);
          }
          
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
          
          // For images, store in image_url; for documents, store in file_url
          if (isImageFile(selectedFile.type)) {
            imagePath = publicUrl;
            // Clear file fields if uploading an image
            fileUrl = null;
            fileType = null;
            fileSize = null;
          } else {
            // Document file
            fileUrl = publicUrl;
            fileType = selectedFile.type;
            fileSize = selectedFile.size;
            // Clear image if uploading a document
            imagePath = null;
          }
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
            file_url: fileUrl,
            file_type: fileType,
            file_size: fileSize,
            type: selectedType,
            id: editingItem?.id, // Pass id for update, undefined for insert
            linked_form_type: formData.linked_form_type
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
        category: selectedType === 'news' ? NEWS_CATEGORIES[1].id : null,
        linked_form_type: null
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

  // Quick visibility toggle: cycles between draft -> published -> featured -> draft
  const handleQuickVisibilityToggle = async (item: ContentItem) => {
    const currentVisibility = getVisibilityFromItem(item);
    
    // Determine next visibility state (cycle through options)
    let nextVisibility: HomepageVisibility;
    if (currentVisibility === 'draft') {
      nextVisibility = 'published';
    } else if (currentVisibility === 'published') {
      nextVisibility = 'featured';
    } else {
      nextVisibility = 'draft';
    }
    
    const flags = getItemFlagsFromVisibility(nextVisibility);
    
    try {
      setError(null);
      
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
      
      // Use Edge Function for secure content update
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          ...item,
          ...flags
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to update visibility');
      }
      
      setSuccess(`Content visibility changed to "${VISIBILITY_OPTIONS.find(opt => opt.value === nextVisibility)?.label}"`);
      fetchContent();
    } catch (error: any) {
      console.error('Error updating visibility:', error);
      setError(`Failed to update visibility: ${error.message}`);
    }
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
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Content Management</h1>
          <p className="mt-1 text-gray-600">Manage website content, featured items, and resources</p>
        </div>
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
                category: selectedType === 'news' ? NEWS_CATEGORIES[1].id : null,
                linked_form_type: null
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
                      {selectedType === 'announcement' ? 'Attachment (Image or Document)' : 'Image'}
                    </label>
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      accept={selectedType === 'announcement' ? ANNOUNCEMENT_ACCEPT_EXTENSIONS : 'image/*'}
                      className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    />
                    {selectedType === 'announcement' && (
                      <p className="mt-1 text-sm text-gray-500">
                        Supported: PDF, Word, Excel, Text files, and Images
                      </p>
                    )}
                    {selectedFile && (
                      <p className="mt-2 text-sm text-green-600">
                        Selected: {selectedFile.name} ({getFileTypeDisplay(selectedFile.type)}, {formatFileSize(selectedFile.size)})
                      </p>
                    )}
                    {/* Show existing file info when editing */}
                    {editingItem && !selectedFile && (editingItem.file_url || editingItem.image_url) && (
                      <p className="mt-2 text-sm text-gray-500">
                        Current: {editingItem.file_url ? `Document (${getFileTypeDisplay(editingItem.file_type)})` : 'Image'}
                      </p>
                    )}
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
                          Link to Form
                        </label>
                        <select
                          value={formData.linked_form_type || ''}
                          onChange={(e) => {
                            const value = e.target.value || null;
                            setFormData({ 
                              ...formData, 
                              linked_form_type: value as any,
                              // Clear manual link if form type is selected
                              link: value ? null : formData.link
                            });
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                        >
                          <option value="">None (No Form Link)</option>
                          <option value="conference">Conference Registration</option>
                          <option value="tech-conference">Tech Conference Registration</option>
                          <option value="regional-luncheon">Regional Luncheon Registration</option>
                          <option value="hall-of-fame">Hall of Fame Nomination</option>
                          <option value="student-scholarship">Student Scholarship Application</option>
                          <option value="exhibitor">Exhibitor Registration</option>
                        </select>
                        <p className="mt-1 text-sm text-gray-500">
                          When published, this event will link to the selected form
                        </p>
                      </div>
                      
                      {!formData.linked_form_type && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Custom Link (Optional)
                          </label>
                          <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <LinkIcon className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                              type="url"
                              value={formData.link || ''}
                              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                              className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                              placeholder="https://example.com"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Homepage Visibility
                    </label>
                    <select
                      value={getVisibilityFromItem(formData)}
                      onChange={(e) => {
                        const visibility = e.target.value as HomepageVisibility;
                        // Validate the visibility value (security: prevent invalid values)
                        if (!VISIBILITY_OPTIONS.some(opt => opt.value === visibility)) {
                          console.error('Invalid visibility value:', visibility);
                          return;
                        }
                        const flags = getItemFlagsFromVisibility(visibility);
                        setFormData({ ...formData, ...flags });
                      }}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                    >
                      {VISIBILITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-sm text-gray-500">
                      {VISIBILITY_OPTIONS.find(opt => opt.value === getVisibilityFromItem(formData))?.description}
                    </p>
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
                    {selectedType === 'event' && (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Form Link
                      </th>
                    )}
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Visibility
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
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.title}
                              className="h-10 w-10 rounded-full object-cover mr-3"
                            />
                          ) : item.file_url ? (
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3" title={`${getFileTypeDisplay(item.file_type)} attachment`}>
                              <FileText className="h-5 w-5 text-blue-600" />
                            </div>
                          ) : null}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{item.title}</div>
                            {item.file_url && (
                              <a 
                                href={item.file_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800"
                              >
                                {getFileTypeDisplay(item.file_type)} • {item.file_size ? formatFileSize(item.file_size) : 'Download'}
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      {selectedType === 'news' && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {NEWS_CATEGORIES.find(cat => cat.id === item.category)?.name || item.category}
                          </div>
                        </td>
                      )}
                      {selectedType === 'event' && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {item.linked_form_type ? (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                {item.linked_form_type === 'conference' && 'Conference Registration'}
                                {item.linked_form_type === 'tech-conference' && 'Tech Conference Registration'}
                                {item.linked_form_type === 'regional-luncheon' && 'Regional Luncheon Registration'}
                                {item.linked_form_type === 'hall-of-fame' && 'Hall of Fame Nomination'}
                                {item.linked_form_type === 'student-scholarship' && 'Student Scholarship'}
                                {item.linked_form_type === 'exhibitor' && 'Exhibitor Registration'}
                              </span>
                            ) : item.link ? (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                                Custom Link
                              </span>
                            ) : (
                              <span className="text-gray-400">None</span>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(() => {
                          const badge = getVisibilityBadge(item);
                          return (
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badge.className}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.date ? new Date(item.date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {/* Quick visibility toggle button */}
                        <button
                          onClick={() => handleQuickVisibilityToggle(item)}
                          className={`mr-2 px-2 py-1 text-xs font-medium rounded ${
                            getVisibilityFromItem(item) === 'featured'
                              ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          title={getVisibilityFromItem(item) === 'featured' ? 'Click to unfeature' : 'Click to feature'}
                        >
                          <Star className={`h-4 w-4 inline-block ${getVisibilityFromItem(item) === 'featured' ? 'fill-yellow-500' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-primary hover:text-primary/80 mr-3"
                          title="Edit"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
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
    </AdminLayout>
  );
};

export default AdminContent;