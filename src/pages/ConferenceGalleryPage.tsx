import { useState, useEffect } from 'react';
import { getVisibleAlbums, type PhotoAlbum } from '../lib/photoAlbums';
import ConferenceGallery from '../components/ConferenceGallery';
import { Calendar } from 'lucide-react';

export default function ConferenceGalleryPage() {
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<PhotoAlbum | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlbums();
  }, []);

  const fetchAlbums = async () => {
    try {
      setLoading(true);
      const data = await getVisibleAlbums();
      setAlbums(data);
      
      // Auto-select the most recent album
      if (data.length > 0) {
        setSelectedAlbum(data[0]);
      }
    } catch (error) {
      console.error('Error fetching albums:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-secondary text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">
              Conference Photo Gallery
            </h1>
            <p className="text-lg opacity-90">
              Browse photos from our conference events over the years
            </p>
          </div>
        </div>
      </section>

      {/* Album Selector */}
      <section className="py-8 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-auto">
              <label htmlFor="album-select" className="block text-sm font-medium text-gray-700 mb-2">
                Select Album
              </label>
              <select
                id="album-select"
                value={selectedAlbum?.id || ''}
                onChange={(e) => {
                  const album = albums.find(a => a.id === e.target.value);
                  setSelectedAlbum(album || null);
                }}
                className="block w-full sm:w-64 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary rounded-md"
              >
                {albums.length === 0 && (
                  <option value="">No albums available</option>
                )}
                {albums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.year} - {album.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedAlbum && (
              <div className="flex flex-col items-start gap-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Year: {selectedAlbum.year}
                </div>
                {selectedAlbum.description && (
                  <p className="text-gray-500">{selectedAlbum.description}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {selectedAlbum ? (
            <ConferenceGallery 
              conferenceId={selectedAlbum.id}
              title=""
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600">
                No photo albums found. Please check back later.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
