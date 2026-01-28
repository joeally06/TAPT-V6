import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { getVisibleAlbums, type PhotoAlbum } from '@/lib/photoAlbums';
import AdminConferenceGallery from './AdminConferenceGallery';

export default function AdminGalleryManagement() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<PhotoAlbum | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      loadAlbums();
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    // Select album from URL parameter if present
    const albumId = searchParams.get('album');
    if (albumId && albums.length > 0) {
      const album = albums.find(a => a.id === albumId);
      if (album) {
        setSelectedAlbum(album);
      }
    } else if (albums.length > 0 && !selectedAlbum) {
      // Auto-select most recent album
      setSelectedAlbum(albums[0]);
    }
  }, [albums, searchParams]);

  const loadAlbums = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getVisibleAlbums();
      
      if (data.length === 0) {
        setError('No photo albums found. Please create an album first.');
      }
      
      setAlbums(data);
    } catch (err) {
      setError('Failed to load albums. Please try again.');
      console.error('Error loading albums:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="inline-flex items-center text-primary hover:text-primary/80 mb-4"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button>
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-secondary">
                Gallery Management
              </h1>
              <button
                onClick={() => navigate('/admin/photo-albums')}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Manage Albums
              </button>
            </div>

            {/* Album Selector */}
            {albums.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <label htmlFor="admin-album-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Album to Manage
                </label>
                <select
                  id="admin-album-select"
                  value={selectedAlbum?.id || ''}
                  onChange={(e) => {
                    const album = albums.find(a => a.id === e.target.value);
                    setSelectedAlbum(album || null);
                  }}
                  className="block w-full sm:w-96 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary rounded-md"
                >
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.year} - {album.name}
                    </option>
                  ))}
                </select>
                {selectedAlbum && selectedAlbum.description && (
                  <p className="mt-2 text-sm text-gray-600">
                    {selectedAlbum.description}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Configuration Required
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>{error}</p>
                  <p className="mt-2">
                    Please go to{' '}
                    <button
                      onClick={() => navigate('/admin/photo-albums')}
                      className="font-medium underline hover:text-yellow-800"
                    >
                      Photo Albums
                    </button>
                    {' '}to create an album first.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gallery Management Component */}
        {selectedAlbum && !error && (
          <AdminConferenceGallery 
            conferenceId={selectedAlbum.id}
            conferenceName={`${selectedAlbum.year} - ${selectedAlbum.name}`}
          />
        )}
      </div>
    </div>
  );
}
