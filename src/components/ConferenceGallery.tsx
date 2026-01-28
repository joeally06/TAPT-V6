import { useState, useEffect } from 'react';
import { getConferenceImages, type GalleryImage } from '@/lib/conferenceGallery';
import { X } from 'lucide-react';

interface ConferenceGalleryProps {
  conferenceId: string;
  title?: string;
}

export default function ConferenceGallery({ conferenceId, title = 'Photo Gallery' }: ConferenceGalleryProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  useEffect(() => {
    loadImages();
  }, [conferenceId]);

  const loadImages = async () => {
    try {
      setLoading(true);
      const data = await getConferenceImages(conferenceId);
      setImages(data);
    } catch (err) {
      console.error('Error loading gallery images:', err);
    } finally {
      setLoading(false);
    }
  };

  const openLightbox = (image: GalleryImage, index: number) => {
    setSelectedImage(image);
    setSelectedIndex(index);
  };

  const closeLightbox = () => {
    setSelectedImage(null);
  };

  const showPrevious = () => {
    if (selectedIndex > 0) {
      const newIndex = selectedIndex - 1;
      setSelectedIndex(newIndex);
      setSelectedImage(images[newIndex]);
    }
  };

  const showNext = () => {
    if (selectedIndex < images.length - 1) {
      const newIndex = selectedIndex + 1;
      setSelectedIndex(newIndex);
      setSelectedImage(images[newIndex]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!selectedImage) return;

    switch (e.key) {
      case 'Escape':
        closeLightbox();
        break;
      case 'ArrowLeft':
        showPrevious();
        break;
      case 'ArrowRight':
        showNext();
        break;
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, selectedIndex]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading gallery...</div>
      </div>
    );
  }

  if (images.length === 0) {
    return null; // Don't show section if no images
  }

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">
          {title}
        </h2>

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => openLightbox(image, index)}
              className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 hover:opacity-90 transition-opacity duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`View photo ${index + 1}${image.caption ? `: ${image.caption}` : ''}`}
            >
              {/* Thumbnail */}
              <img
                src={image.thumbnail_url}
                alt={image.caption || `Conference photo ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />

              {/* Caption preview (if exists) */}
              {image.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <p className="text-white text-xs line-clamp-2">
                    {image.caption}
                  </p>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Lightbox Modal */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
            onClick={closeLightbox}
          >
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-10"
              aria-label="Close lightbox"
            >
              <X size={32} />
            </button>

            {/* Previous button */}
            {selectedIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showPrevious();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors z-10"
                aria-label="Previous photo"
              >
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}

            {/* Next button */}
            {selectedIndex < images.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors z-10"
                aria-label="Next photo"
              >
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}

            {/* Image container */}
            <div
              className="relative max-w-7xl max-h-[90vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Full-size image */}
              <img
                src={selectedImage.image_url}
                alt={selectedImage.caption || `Conference photo ${selectedIndex + 1}`}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />

              {/* Caption and metadata */}
              <div className="mt-4 text-center text-white space-y-2 max-w-2xl">
                {selectedImage.caption && (
                  <p className="text-lg">{selectedImage.caption}</p>
                )}
                <p className="text-sm text-white/60">
                  Photo {selectedIndex + 1} of {images.length}
                  {selectedImage.created_at && (
                    <> • Uploaded {new Date(selectedImage.created_at).toLocaleDateString()}</>
                  )}
                </p>
              </div>
            </div>

            {/* Keyboard hints */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs">
              Use arrow keys to navigate • ESC to close
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
