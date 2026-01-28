import { useState, useEffect } from 'react';
import {
  getAllAlbums,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  getAlbumPhotoCount,
  type PhotoAlbum
} from '@/lib/photoAlbums';
import { useNavigate } from 'react-router-dom';

export default function AdminPhotoAlbums() {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
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
      await createAlbum(formData.name, formData.year, formData.description);
      setShowCreateForm(false);
      setFormData({ name: '', year: new Date().getFullYear(), description: '' });
      await loadAlbums();
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading albums...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Photo Albums</h1>
            <p className="mt-1 text-gray-600">
              Manage conference photo galleries by name and year
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + Create Album
          </button>
        </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Create New Album</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Album Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Annual Conference, Summer Workshop"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Brief description of the album..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Album
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Albums List */}
      <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
        {albums.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No albums yet. Create your first album to get started.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Photos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visible
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {albums.map((album) => (
                editingId === album.id ? (
                  <tr key={album.id} className="bg-blue-50">
                    <td colSpan={5} className="px-6 py-4">
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <input
                          type="number"
                          min="1900"
                          max="2100"
                          value={formData.year}
                          onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdate(album.id)}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={album.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{album.name}</div>
                      {album.description && (
                        <div className="text-sm text-gray-500 mt-1">{album.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{album.year}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {photoCounts[album.id] || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleVisibility(album)}
                        className={`px-2 py-1 text-xs rounded ${
                          album.is_visible
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {album.is_visible ? 'Visible' : 'Hidden'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => navigate(`/admin/gallery-management?album=${album.id}`)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Manage Photos
                      </button>
                      <button
                        onClick={() => startEdit(album)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(album.id, album.name)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>
    </div>
  );
}
