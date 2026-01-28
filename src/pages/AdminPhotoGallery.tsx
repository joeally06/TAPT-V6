import { useState, useEffect } from 'react';
import {
  getAllAlbums,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  getAlbumPhotoCount,
  type PhotoAlbum
} from '@/lib/photoAlbums';
import AdminConferenceGallery from './AdminConferenceGallery';
import AdminLayout from '@/components/AdminLayout';

export default function AdminPhotoGallery() {
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [selectedAlbum, setSelectedAlbum] = useState<PhotoAlbum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    year: new Date().getFullYear(),
    description: ''
  });

  useEffect(() => {
    loadAlbums();
  }, []);

  const loadAlbums = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllAlbums();
      setAlbums(data);

      // Load photo counts for each album
      const counts: Record<string, number> = {};
      await Promise.all(
        data.map(async (album) => {
          counts[album.id] = await getAlbumPhotoCount(album.id);
        })
      );
      setPhotoCounts(counts);

      // Auto-select first album if none selected
      if (!selectedAlbum && data.length > 0) {
        setSelectedAlbum(data[0]);
      }
    } catch (err) {
      setError('Failed to load albums. Please try again.');
      console.error('Error loading albums:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const newAlbum = await createAlbum(formData.name, formData.year, formData.description);
      setShowCreateForm(false);
      setFormData({ name: '', year: new Date().getFullYear(), description: '' });
      await loadAlbums();
      if (newAlbum) {
        setSelectedAlbum(newAlbum);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create album.');
    }
  };

  const handleUpdate = async (id: string) => {
    setError(null);

    try {
      await updateAlbum(id, formData);
      setEditingId(null);
      setFormData({ name: '', year: new Date().getFullYear(), description: '' });
      await loadAlbums();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update album.');
    }
  };

  const handleDelete = async (id: string, albumName: string) => {
    const photoCount = photoCounts[id] || 0;
    const confirmMessage = photoCount > 0
      ? `Delete "${albumName}"? This will permanently delete ${photoCount} photo${photoCount !== 1 ? 's' : ''}.`
      : `Delete "${albumName}"?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setError(null);
      await deleteAlbum(id);
      if (selectedAlbum?.id === id) {
        setSelectedAlbum(null);
      }
      await loadAlbums();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete album.');
    }
  };

  const startEdit = (album: PhotoAlbum) => {
    setEditingId(album.id);
    setFormData({
      name: album.name,
      year: album.year,
      description: album.description || ''
    });
    setShowCreateForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowCreateForm(false);
    setFormData({ name: '', year: new Date().getFullYear(), description: '' });
  };

  const toggleVisibility = async (album: PhotoAlbum) => {
    try {
      await updateAlbum(album.id, { is_visible: !album.is_visible });
      await loadAlbums();
    } catch (err) {
      setError('Failed to update visibility.');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">Loading albums...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Photo Gallery Management</h1>
          <p className="mt-1 text-gray-600">
            Manage photo albums and upload images
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Albums Section */}
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Albums ({albums.length})</h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {showCreateForm ? 'Cancel' : '+ Create Album'}
            </button>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <form onSubmit={handleCreate} className="mb-6 p-4 bg-blue-50 rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Album Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Annual Conference"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Year *
                  </label>
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="Brief description..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Album
              </button>
            </form>
          )}

          {/* Albums Grid */}
          {albums.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No albums yet. Create your first album to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {albums.map((album) => (
                editingId === album.id ? (
                  <div key={album.id} className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300 space-y-3">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <input
                      type="number"
                      min="1900"
                      max="2100"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(album.id)}
                        className="flex-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={album.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedAlbum?.id === album.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedAlbum(album)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{album.name}</h3>
                        <p className="text-sm text-gray-600">Year: {album.year}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVisibility(album);
                        }}
                        className={`px-2 py-1 text-xs rounded ${
                          album.is_visible
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {album.is_visible ? 'Visible' : 'Hidden'}
                      </button>
                    </div>
                    
                    {album.description && (
                      <p className="text-sm text-gray-500 mb-2">{album.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                      <span className="text-sm text-gray-600">
                        {photoCounts[album.id] || 0} photo{photoCounts[album.id] !== 1 ? 's' : ''}
                      </span>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => startEdit(album)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(album.id, album.name)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>

        {/* Photo Management Section */}
        {selectedAlbum ? (
          <div className="bg-white border border-gray-300 rounded-lg p-6">
            <AdminConferenceGallery 
              conferenceId={selectedAlbum.id}
              conferenceName={`${selectedAlbum.year} - ${selectedAlbum.name}`}
            />
          </div>
        ) : (
          albums.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-600">Select an album above to manage photos</p>
            </div>
          )
        )}
      </div>
    </AdminLayout>
  );
}
