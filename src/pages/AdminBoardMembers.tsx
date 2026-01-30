import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit, MoveUp, MoveDown, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uploadFile } from '../lib/upload';
import AdminLayout from '../components/AdminLayout';

interface BoardMember {
  id: string;
  name: string;
  title: string;
  district: string | null;
  bio: string | null;
  image: string | null;
  order: number;
}

export const AdminBoardMembers: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<BoardMember | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<Partial<BoardMember>>({
    name: '',
    title: '',
    district: '',
    bio: '',
    image: '',
    order: 0
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
      fetchMembers();
    }
    // eslint-disable-next-line
  }, [authLoading, user]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('board_members')
        .select('*')
        .order('order', { ascending: true });

      if (error) throw error;

      setMembers(data || []);
    } catch (error: any) {
      console.error('Error fetching board members:', error);
      setError('Failed to load board members');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        setSelectedFile(file);
        setFormData(prev => ({ ...prev, image: file.name }));
      } else {
        setError('Please select an image file');
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      setUploading(true);
      setError(null);
      // Use the uploadFile helper to upload to Supabase storage via Edge Function
      if (!user?.access_token) throw new Error('User not authenticated');
      const imagePath = await uploadFile(selectedFile, 'board-members', user.access_token, { bucket: 'public' });
      setFormData(prev => ({ ...prev, image: imagePath }));
      setSuccess('Image uploaded successfully!');
      return imagePath;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      setError('Failed to upload image. Please try again.');
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      let imagePath = formData.image;
      if (selectedFile) {
        imagePath = await handleUpload();
      }
      // Use Edge Function for upsert (add/update)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-board-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({
          ...formData,
          image: imagePath,
          id: editingMember ? editingMember.id : undefined,
          order: formData.order || members.length
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save board member');
      }
      setSuccess(`Board member ${editingMember ? 'updated' : 'added'} successfully!`);
      setShowForm(false);
      setEditingMember(null);
      setSelectedFile(null);
      setFormData({
        name: '',
        title: '',
        district: '',
        bio: '',
        image: '',
        order: 0
      });
      fetchMembers();
    } catch (error: any) {
      console.error('Error saving board member:', error);
      setError(`Failed to save board member: ${error.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this board member?')) return;
    try {
      // Get the member to delete their image if it exists
      const memberToDelete = members.find(m => m.id === id);
      // Use Edge Function for delete (handles both DB and image)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-board-member`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({ id, image: memberToDelete?.image || undefined })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to delete board member');
      }
      setSuccess('Board member deleted successfully!');
      fetchMembers();
    } catch (error: any) {
      console.error('Error deleting board member:', error);
      setError(`Failed to delete board member: ${error.message}`);
    }
  };

  const handleMove = async (memberId: string, direction: 'up' | 'down') => {
    const memberIndex = members.findIndex(m => m.id === memberId);
    if (
      (direction === 'up' && memberIndex === 0) ||
      (direction === 'down' && memberIndex === members.length - 1)
    ) {
      return;
    }
    const newMembers = [...members];
    const swapIndex = direction === 'up' ? memberIndex - 1 : memberIndex + 1;
    // Swap order values
    const tempOrder = newMembers[memberIndex].order;
    newMembers[memberIndex].order = newMembers[swapIndex].order;
    newMembers[swapIndex].order = tempOrder;
    try {
      // Use Edge Function for reordering
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-board-member`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({
          reorder: true,
          members: [
            { id: newMembers[memberIndex].id, order: newMembers[memberIndex].order },
            { id: newMembers[swapIndex].id, order: newMembers[swapIndex].order }
          ]
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reorder board members');
      }
      fetchMembers();
    } catch (error: any) {
      console.error('Error reordering board members:', error);
      setError(`Failed to reorder board members: ${error.message}`);
    }
  };

  const handleEdit = (member: BoardMember) => {
    setEditingMember(member);
    setFormData(member);
    setShowForm(true);
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Manage Board Members</h1>
          <p className="mt-1 text-gray-600">Add, edit, or remove board members</p>
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

        {/* Add Member Button */}
        <div className="mb-6">
          <button
            onClick={() => {
              setEditingMember(null);
              setFormData({
                name: '',
                title: '',
                district: '',
                bio: '',
                image: '',
                order: members.length
              });
              setShowForm(!showForm);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add New Member
          </button>
        </div>

        {/* Add/Edit Member Form */}
        {showForm && (
          <div className="mb-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-secondary mb-6">
              {editingMember ? 'Edit Board Member' : 'Add New Board Member'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Title <span className="text-red-500">*</span>
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
                    District
                  </label>
                  <input
                    type="text"
                    value={formData.district || ''}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Image
                  </label>
                  <div className="mt-1 flex items-center space-x-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Upload className="h-5 w-5 mr-2" />
                      Choose Image
                    </button>
                    {selectedFile && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">{selectedFile.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            setFormData(prev => ({ ...prev, image: '' }));
                          }}
                          className="text-gray-400 hover:text-gray-500"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Upload a profile image (JPG, PNG)
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Bio
                </label>
                <textarea
                  value={formData.bio || ''}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingMember(null);
                    setSelectedFile(null);
                    setFormData({
                      name: '',
                      title: '',
                      district: '',
                      bio: '',
                      image: '',
                      order: 0
                    });
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
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    editingMember ? 'Update Member' : 'Add Member'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Members List */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  District
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.map((member, index) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {member.image && (
                        <img
                          src={`/images/board-members/${member.image}`}
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
                    <div className="text-sm text-gray-500">{member.district}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => handleMove(member.id, 'up')}
                        disabled={index === 0}
                        className={`p-1 rounded hover:bg-gray-100 ${index === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <MoveUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleMove(member.id, 'down')}
                        disabled={index === members.length - 1}
                        className={`p-1 rounded hover:bg-gray-100 ${index === members.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <MoveDown className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(member)}
                      className="text-primary hover:text-primary/80 mr-3"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(member.id)}
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
      </div>
    </AdminLayout>
  );
};

export default AdminBoardMembers;