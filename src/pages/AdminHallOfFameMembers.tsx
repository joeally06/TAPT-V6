import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Award, MapPin, Globe, Mail, Plus, Edit, Trash2, Search, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uploadFile } from '../lib/upload';
import AdminLayout from '../components/AdminLayout';

interface HallOfFameMember {
  id: string;
  name: string;
  title: string;
  role: string | null;
  organization: string | null;
  location: string | null;
  contact_info: {
    email?: string;
    phone?: string;
  } | null;
  image_url: string | null;
  website: string | null;
  notes: string | null;
  term: string | null;
  induction_year: number;
  achievements: string[];
  bio: string;
}

export const AdminHallOfFameMembers: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [members, setMembers] = useState<HallOfFameMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<HallOfFameMember>>({
    name: '',
    title: '',
    role: '',
    organization: '',
    location: '',
    contact_info: {
      email: '',
      phone: ''
    },
    image_url: '',
    website: '',
    notes: '',
    term: '',
    induction_year: new Date().getFullYear(),
    achievements: [],
    bio: ''
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof HallOfFameMember>('induction_year');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;
      
      if (!session) {
        navigate('/admin/login');
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (userError) throw userError;

      if (!userData || userData.role !== 'admin') {
        await supabase.auth.signOut();
        navigate('/admin/login');
        return;
      }

      fetchMembers();
    } catch (error) {
      console.error('Session check error:', error);
      navigate('/admin/login');
    }
  };

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('hall_of_fame_members')
        .select('*')
        .order(sortField, { ascending: sortDirection === 'asc' });

      if (error) throw error;

      setMembers(data || []);
    } catch (error: any) {
      console.error('Error fetching members:', error);
      setError('Failed to load Hall of Fame members');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof HallOfFameMember) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      let imageUrl = formData.image_url || '';
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        
        // Upload to the 'public' bucket, in the 'hall_of_fame' folder
        if (!user?.access_token) throw new Error('User not authenticated');
        
        const imagePath = await uploadFile(
          selectedImage, 
          'hall_of_fame', 
          user.access_token, 
          { bucket: 'public' }
        );
        
        const { data } = supabase.storage
          .from('public')
          .getPublicUrl(imagePath);
          
        imageUrl = data.publicUrl;
      }
      
      // Use Edge Function for secure member creation/update
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-hof-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({ 
          ...formData, 
          image_url: imageUrl,
          id: isEditing ? formData.id : undefined
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save member');
      }

      setSuccess(`Member ${isEditing ? 'updated' : 'added'} successfully!`);
      setShowForm(false);
      resetForm();
      fetchMembers();
    } catch (error: any) {
      console.error('Error saving member:', error);
      setError(`Failed to save member: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      title: '',
      role: '',
      organization: '',
      location: '',
      contact_info: { email: '', phone: '' },
      image_url: '',
      website: '',
      notes: '',
      term: '',
      induction_year: new Date().getFullYear(),
      achievements: [],
      bio: ''
    });
    setSelectedImage(null);
    setIsEditing(false);
  };

  const handleEdit = (member: HallOfFameMember) => {
    setFormData(member);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this member?')) return;

    try {
      // Use Edge Function for secure member deletion
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-hof-member`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({ id })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete member');
      }

      setSuccess('Member deleted successfully!');
      fetchMembers();
    } catch (error: any) {
      console.error('Error deleting member:', error);
      setError(`Failed to delete member: ${error.message}`);
    }
  };

  // Filter members based on search term
  const filteredMembers = members.filter(member => {
    const searchLower = searchTerm.toLowerCase();
    return (
      member.name.toLowerCase().includes(searchLower) ||
      member.title.toLowerCase().includes(searchLower) ||
      (member.organization && member.organization.toLowerCase().includes(searchLower)) ||
      member.induction_year.toString().includes(searchLower)
    );
  });

  if (loading) {
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
          <h1 className="text-3xl font-bold text-gray-900">Manage Hall of Fame Members</h1>
          <p className="mt-1 text-gray-600">Add, edit, or remove Hall of Fame members</p>
        </div>
        {/* Status Messages */}
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

        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add New Member
          </button>
          
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
        </div>

        {/* Add/Edit Member Form */}
        {showForm && (
          <div className="mb-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-secondary mb-6">
              {isEditing ? 'Edit Hall of Fame Member' : 'Add New Hall of Fame Member'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Organization</label>
                  <input
                    type="text"
                    value={formData.organization || ''}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Location</label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={formData.contact_info?.email || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      contact_info: { ...formData.contact_info, email: e.target.value }
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Website</label>
                  <input
                    type="url"
                    value={formData.website || ''}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                  {selectedImage && (
                    <p className="mt-2 text-sm text-gray-500">Selected: {selectedImage.name}</p>
                  )}
                  {formData.image_url && !selectedImage && (
                    <div className="mt-2 flex items-center">
                      <span className="text-sm text-gray-500 mr-2">Current image:</span>
                      <a 
                        href={formData.image_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm flex items-center"
                      >
                        View <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Induction Year</label>
                  <input
                    type="number"
                    value={formData.induction_year}
                    onChange={(e) => setFormData({ ...formData, induction_year: parseInt(e.target.value) })}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <input
                    type="text"
                    value={formData.role || ''}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Term</label>
                  <input
                    type="text"
                    value={formData.term || ''}
                    onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                    placeholder="e.g., 2020-2024"
                  />
                </div>
              </div>

              {/* Achievements */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Achievements</label>
                <textarea
                  value={formData.achievements?.join('\n')}
                  onChange={(e) => setFormData({ ...formData, achievements: e.target.value.split('\n').filter(Boolean) })}
                  required
                  rows={4}
                  placeholder="Enter each achievement on a new line"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Biography</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  required
                  rows={6}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
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
                      {isEditing ? 'Updating...' : 'Saving...'}
                    </>
                  ) : (
                    isEditing ? 'Update Member' : 'Add Member'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Members Table */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {members.length === 0 ? (
            <div className="p-8 text-center">
              <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Members Found</h3>
              <p className="mt-1 text-gray-500">Add your first Hall of Fame member to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Name
                        {sortField === 'name' && (
                          sortDirection === 'asc' ? 
                            <ChevronUp className="ml-1 h-4 w-4" /> : 
                            <ChevronDown className="ml-1 h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center">
                        Title
                        {sortField === 'title' && (
                          sortDirection === 'asc' ? 
                            <ChevronUp className="ml-1 h-4 w-4" /> : 
                            <ChevronDown className="ml-1 h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('organization')}
                    >
                      <div className="flex items-center">
                        Organization
                        {sortField === 'organization' && (
                          sortDirection === 'asc' ? 
                            <ChevronUp className="ml-1 h-4 w-4" /> : 
                            <ChevronDown className="ml-1 h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('induction_year')}
                    >
                      <div className="flex items-center">
                        Induction Year
                        {sortField === 'induction_year' && (
                          sortDirection === 'asc' ? 
                            <ChevronUp className="ml-1 h-4 w-4" /> : 
                            <ChevronDown className="ml-1 h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {member.image_url && (
                            <img 
                              src={member.image_url} 
                              alt={member.name}
                              className="h-10 w-10 rounded-full object-cover mr-3"
                            />
                          )}
                          <div className="text-sm font-medium text-gray-900">{member.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{member.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{member.organization || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{member.induction_year}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(member)}
                          className="text-primary hover:text-primary/80 mr-3"
                          title="Edit member"
                          aria-label={`Edit ${member.name}`}
                        >
                          <Edit className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleDelete(member.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete member"
                          aria-label={`Delete ${member.name}`}
                        >
                          <Trash2 className="h-5 w-5" aria-hidden="true" />
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

export default AdminHallOfFameMembers;