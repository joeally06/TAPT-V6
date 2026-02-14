import { useState, useEffect, useCallback } from 'react';
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

  const openLightbox = useCallback((image: GalleryImage, index: number) => {
    setSelectedImage(image);
    setSelectedIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setSelectedImage(null);
  }, []);

  const showPrevious = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev > 0) {
        const newIndex = prev - 1;
        setSelectedImage(images[newIndex]);
        return newIndex;
      }
      return prev;
    });
  }, [images]);

  const showNext = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev < images.length - 1) {
        const newIndex = prev + 1;
        setSelectedImage(images[newIndex]);
        return newIndex;
      }
      return prev;
    });
  }, [images]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImage) {
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, closeLightbox, showPrevious, showNext]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (selectedImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedImage]);

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

  // Preview images for collage (up to 5)
  const previewImages = images.slice(0, 5);
  const remainingCount = images.length - 5;

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        {title && (
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">
            {title}
          </h2>
        )}

        {/* ─── Collage Preview ─── */}
        <div
          className="relative cursor-pointer group rounded-xl overflow-hidden"
          onClick={() => openLightbox(images[0], 0)}
          role="button"
          tabIndex={0}
          aria-label={`View all ${images.length} photos`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openLightbox(images[0], 0);
            }
          }}
        >
          {/* Single image */}
          {images.length === 1 && (
            <div className="aspect-[16/9] max-h-[500px]">
              <img
                src={previewImages[0].thumbnail_url}
                alt={previewImages[0].caption || 'Conference photo'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Two images side-by-side */}
          {images.length === 2 && (
            <div className="grid grid-cols-2 gap-1 max-h-[500px]">
              {previewImages.map((img, i) => (
                <div key={img.id} className="aspect-[4/3]">
                  <img
                    src={img.thumbnail_url}
                    alt={img.caption || `Conference photo ${i + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Three images: 1 large left + 2 stacked right */}
          {images.length === 3 && (
            <div className="grid grid-cols-2 gap-1" style={{ height: '400px' }}>
              <div className="row-span-2 h-full">
                <img
                  src={previewImages[0].thumbnail_url}
                  alt={previewImages[0].caption || 'Conference photo 1'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="h-full">
                <img
                  src={previewImages[1].thumbnail_url}
                  alt={previewImages[1].caption || 'Conference photo 2'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="h-full">
                <img
                  src={previewImages[2].thumbnail_url}
                  alt={previewImages[2].caption || 'Conference photo 3'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          )}

          {/* Four images: 1 large left + 3 stacked right */}
          {images.length === 4 && (
            <div className="grid grid-cols-3 gap-1" style={{ height: '450px' }}>
              <div className="col-span-2 row-span-3 h-full">
                <img
                  src={previewImages[0].thumbnail_url}
                  alt={previewImages[0].caption || 'Conference photo 1'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              {previewImages.slice(1).map((img, i) => (
                <div key={img.id} className="h-full">
                  <img
                    src={img.thumbnail_url}
                    alt={img.caption || `Conference photo ${i + 2}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Five+ images: hero left + 2×2 grid right */}
          {images.length >= 5 && (
            <div className="grid grid-cols-4 grid-rows-2 gap-1" style={{ height: '450px' }}>
              {/* Hero image — left half */}
              <div className="col-span-2 row-span-2">
                <img
                  src={previewImages[0].thumbnail_url}
                  alt={previewImages[0].caption || 'Conference photo 1'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              {/* Top-right pair */}
              <div>
                <img
                  src={previewImages[1].thumbnail_url}
                  alt={previewImages[1].caption || 'Conference photo 2'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div>
                <img
                  src={previewImages[2].thumbnail_url}
                  alt={previewImages[2].caption || 'Conference photo 3'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              {/* Bottom-right pair */}
              <div>
                <img
                  src={previewImages[3].thumbnail_url}
                  alt={previewImages[3].caption || 'Conference photo 4'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="relative">
                <img
                  src={previewImages[4].thumbnail_url}
                  alt={previewImages[4].caption || 'Conference photo 5'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* "+X more" overlay on last collage tile */}
                {remainingCount > 0 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-xl font-semibold">
                      +{remainingCount} more
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hover overlay – "View all photos" pill */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 pointer-events-none" />
          <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            <span className="inline-flex items-center gap-2 bg-white/95 text-gray-900 px-4 py-2 rounded-lg shadow-lg text-sm font-medium backdrop-blur-sm">
              View all {images.length} photos
            </span>
          </div>
        </div>

        {/* ─── Lightbox Modal (single image viewer) ─── */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
            onClick={closeLightbox}
            role="dialog"
            aria-modal="true"
            aria-label="Photo viewer"
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
                    <> &bull; Uploaded {new Date(selectedImage.created_at).toLocaleDateString()}</>
                  )}
                </p>
              </div>
            </div>

            {/* Keyboard hints */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs">
              Use arrow keys to navigate &bull; ESC to close
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
