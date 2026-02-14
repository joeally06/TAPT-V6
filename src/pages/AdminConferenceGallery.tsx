import { useState, useEffect, useCallback } from 'react';
import {
  uploadConferenceImage,
  getConferenceImages,
  deleteConferenceImage,
  updateImageCaption,
  reorderImages,
  saveImageMetadata,
  type GalleryImage
} from '@/lib/conferenceGallery';
import { Grid, List, GripVertical } from 'lucide-react';

interface AdminConferenceGalleryProps {
  conferenceId: string;
  conferenceName: string;
}

export default function AdminConferenceGallery({ conferenceId, conferenceName }: AdminConferenceGalleryProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('compact');

  // Drag-and-drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  useEffect(() => {
    loadImages();
  }, [conferenceId]);

  const loadImages = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getConferenceImages(conferenceId);
      setImages(data);
    } catch (err) {
      setError('Failed to load gallery images. Please try again.');
      console.error('Error loading images:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Convert FileList to Array
    const fileArray = Array.from(files);
    
    // Validate all files first
    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} is not an image file (JPEG, PNG, or WebP)`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is over 10MB`);
        return;
      }
    }

    setUploading(true);
    setError(null);
    
    const totalFiles = fileArray.length;
    let successCount = 0;
    let failCount = 0;
    const newImages: any[] = [];

    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setUploadProgress(`Processing ${i + 1}/${totalFiles}: ${file.name}...`);

        try {
          // Upload and compress
          const result = await uploadConferenceImage(file, conferenceId);
          
          if (!result) {
            throw new Error('Upload failed');
          }

          // Save metadata to database
          const nextOrder = images.length + newImages.length;

          const savedImage = await saveImageMetadata({
            albumId: conferenceId,
            imageUrl: result.fullUrl,
            thumbnailUrl: result.thumbUrl,
            originalFilename: file.name,
            fileSize: result.fileSize,
            displayOrder: nextOrder
          });

          if (savedImage) {
            newImages.push(savedImage);
            successCount++;
          }
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err);
          failCount++;
        }
      }

      // Update images list with all new uploads
      if (newImages.length > 0) {
        setImages(prev => [...prev, ...newImages]);
      }

      // Show result summary
      if (failCount === 0) {
        setUploadProgress(`✅ Successfully uploaded ${successCount} image${successCount !== 1 ? 's' : ''}!`);
      } else {
        setUploadProgress(`⚠️ Uploaded ${successCount}, failed ${failCount}`);
        if (successCount === 0) {
          setError(`Failed to upload ${failCount} image${failCount !== 1 ? 's' : ''}. Please try again.`);
        }
      }
      
      setTimeout(() => setUploadProgress(''), 3000);

      // Reset input
      e.target.value = '';
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload images. Please try again.');
      setUploadProgress('');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image? This cannot be undone.')) {
      return;
    }

    try {
      setError(null);
      await deleteConferenceImage(imageId);
      setImages(prev => prev.filter(img => img.id !== imageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image.');
      console.error('Delete error:', err);
    }
  };

  const handleUpdateCaption = async (imageId: string) => {
    try {
      setError(null);
      await updateImageCaption(imageId, captionText);
      setImages(prev =>
        prev.map(img =>
          img.id === imageId ? { ...img, caption: captionText } : img
        )
      );
      setEditingCaption(null);
      setCaptionText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update caption.');
      console.error('Caption update error:', err);
    }
  };

  // ─── Drag-and-Drop Handlers ───
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Use a small transparent image to avoid the default browser ghost
    const ghost = document.createElement('div');
    ghost.style.opacity = '0';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }, [dragOverIndex]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    // Reorder the array
    const newImages = [...images];
    const [draggedItem] = newImages.splice(draggedIndex, 1);
    newImages.splice(dropIndex, 0, draggedItem);

    // Optimistically update UI
    const reordered = newImages.map((img, idx) => ({ ...img, display_order: idx }));
    setImages(reordered);
    setDraggedIndex(null);

    // Persist to database
    const updates = reordered.map((img, idx) => ({ id: img.id, display_order: idx }));
    try {
      setIsSavingOrder(true);
      await reorderImages(updates);
    } catch (err) {
      setError('Failed to save new order. Reverting...');
      console.error('Drag reorder error:', err);
      await loadImages(); // Revert on error
    } finally {
      setIsSavingOrder(false);
    }
  }, [draggedIndex, images]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;

    const newImages = [...images];
    [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];

    // Update display orders
    const updates = newImages.map((img, idx) => ({
      id: img.id,
      display_order: idx
    }));

    try {
      await reorderImages(updates);
      setImages(newImages.map((img, idx) => ({ ...img, display_order: idx })));
    } catch (err) {
      setError('Failed to reorder images.');
      console.error('Reorder error:', err);
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === images.length - 1) return;

    const newImages = [...images];
    [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];

    const updates = newImages.map((img, idx) => ({
      id: img.id,
      display_order: idx
    }));

    try {
      await reorderImages(updates);
      setImages(newImages.map((img, idx) => ({ ...img, display_order: idx })));
    } catch (err) {
      setError('Failed to reorder images.');
      console.error('Reorder error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading gallery...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Photo Gallery - {conferenceName}
        </h2>
        <p className="text-gray-600">
          Upload and manage conference photos. Images are automatically compressed to optimize storage.
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white border border-gray-300 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Upload Photos</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Images (Multiple)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              onChange={handleFileUpload}
              disabled={uploading}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {uploadProgress && (
            <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded p-3">
              {uploadProgress}
            </div>
          )}

          <p className="text-xs text-gray-500">
            Supported formats: JPEG, PNG, WebP • Maximum original size: 10MB per image<br />
            <strong>You can select multiple images at once.</strong> Images will be automatically compressed to ~500KB (full) + ~50KB (thumbnail)
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Saving Order Indicator */}
      {isSavingOrder && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700">Saving new photo order...</p>
        </div>
      )}

      {/* Gallery Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Gallery Images ({images.length})
            {images.length > 1 && (
              <span className="text-sm font-normal text-gray-500 ml-2">Drag to reorder</span>
            )}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('compact')}
              className={`px-3 py-1.5 text-sm rounded flex items-center gap-2 ${
                viewMode === 'compact'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Grid className="h-4 w-4" />
              Compact
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-sm rounded flex items-center gap-2 ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <List className="h-4 w-4" />
              Detailed
            </button>
          </div>
        </div>

        {images.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-gray-500">No images uploaded yet. Upload your first photo above.</p>
          </div>
        ) : viewMode === 'compact' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {images.map((image, index) => (
              <div
                key={image.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`bg-white border-2 rounded-lg overflow-hidden transition-all duration-200 group ${
                  draggedIndex === index
                    ? 'opacity-40 scale-95 border-blue-400 bg-blue-50'
                    : dragOverIndex === index && draggedIndex !== null
                      ? 'border-blue-500 ring-2 ring-blue-300 ring-offset-1 scale-[1.02]'
                      : 'border-gray-200 hover:shadow-md'
                } ${draggedIndex !== null ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                {/* Compact Image View */}
                <div className="aspect-square bg-gray-100 relative">
                  <img
                    src={image.thumbnail_url}
                    alt={image.caption || `Photo ${index + 1}`}
                    className="w-full h-full object-cover pointer-events-none"
                    loading="lazy"
                    draggable={false}
                  />
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                    <GripVertical className="h-3 w-3" />
                    #{index + 1}
                  </div>
                  
                  {/* Drop Indicator */}
                  {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index && (
                    <div className="absolute inset-0 pointer-events-none z-20">
                      <div className={`absolute ${
                        draggedIndex < index ? 'bottom-0 left-0 right-0 h-1' : 'top-0 left-0 right-0 h-1'
                      } bg-blue-500 rounded-full`} />
                    </div>
                  )}
                  
                  {/* Hover Overlay with Actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2">
                    <button
                      onClick={() => window.open(image.image_url, '_blank')}
                      className="w-full px-2 py-1 text-xs bg-white text-gray-800 rounded hover:bg-gray-100"
                    >
                      View Full
                    </button>
                    <button
                      onClick={() => {
                        setEditingCaption(image.id);
                        setCaptionText(image.caption || '');
                      }}
                      className="w-full px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Caption
                    </button>
                    <div className="flex gap-1 w-full">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="flex-1 px-1 py-1 text-xs bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-30"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === images.length - 1}
                        className="flex-1 px-1 py-1 text-xs bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-30"
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      onClick={() => handleDelete(image.id)}
                      className="w-full px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                
                {/* Caption Badge */}
                {image.caption && (
                  <div className="p-1.5 text-xs text-gray-600 truncate" title={image.caption}>
                    {image.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {images.map((image, index) => (
              <div
                key={image.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`bg-white border-2 rounded-lg overflow-hidden shadow-sm transition-all duration-200 ${
                  draggedIndex === index
                    ? 'opacity-40 scale-95 border-blue-400 bg-blue-50'
                    : dragOverIndex === index && draggedIndex !== null
                      ? 'border-blue-500 ring-2 ring-blue-300 ring-offset-2 scale-[1.01]'
                      : 'border-gray-300'
                } ${draggedIndex !== null ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                {/* Image */}
                <div className="aspect-video bg-gray-100 relative">
                  <img
                    src={image.thumbnail_url}
                    alt={image.caption || image.original_filename}
                    className="w-full h-full object-cover pointer-events-none"
                    loading="lazy"
                    draggable={false}
                  />
                  <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <GripVertical className="h-3 w-3" />
                    #{index + 1}
                  </div>
                  
                  {/* Drop Indicator */}
                  {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index && (
                    <div className="absolute inset-0 pointer-events-none z-20">
                      <div className={`absolute ${
                        draggedIndex < index ? 'bottom-0 left-0 right-0 h-1' : 'top-0 left-0 right-0 h-1'
                      } bg-blue-500 rounded-full`} />
                    </div>
                  )}
                </div>

                {/* Info & Controls */}
                <div className="p-4 space-y-3">
                  {/* Caption */}
                  {editingCaption === image.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={captionText}
                        onChange={(e) => setCaptionText(e.target.value)}
                        placeholder="Enter caption (optional)"
                        maxLength={500}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateCaption(image.id)}
                          className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingCaption(null);
                            setCaptionText('');
                          }}
                          className="text-xs px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-700 min-h-[2.5rem]">
                        {image.caption || (
                          <span className="text-gray-400 italic">No caption</span>
                        )}
                      </p>
                      <button
                        onClick={() => {
                          setEditingCaption(image.id);
                          setCaptionText(image.caption || '');
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                      >
                        {image.caption ? 'Edit' : 'Add'} caption
                      </button>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>{image.original_filename}</div>
                    <div>{(image.file_size_bytes / 1024).toFixed(0)} KB</div>
                    <div>Uploaded {new Date(image.created_at).toLocaleDateString()}</div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="flex-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ↑ Move Up
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === images.length - 1}
                      className="flex-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ↓ Move Down
                    </button>
                    <button
                      onClick={() => handleDelete(image.id)}
                      className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Caption Edit Modal (for compact view) */}
      {editingCaption && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Edit Photo Caption</h3>
            <textarea
              value={captionText}
              onChange={(e) => setCaptionText(e.target.value)}
              placeholder="Enter caption (optional)"
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setEditingCaption(null);
                  setCaptionText('');
                }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateCaption(editingCaption)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save Caption
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
