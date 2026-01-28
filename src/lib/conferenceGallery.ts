/**
 * Conference Gallery Management
 * 
 * Handles image uploads, retrieval, and management for conference photo galleries.
 * Uses Supabase Storage with client-side compression for optimal performance.
 */

import { supabase } from './supabase';
import { compressImage, createThumbnail } from './imageCompression';

export interface GalleryImage {
  id: string;
  album_id: string;
  image_url: string;
  thumbnail_url: string;
  caption?: string;
  display_order: number;
  original_filename: string;
  file_size_bytes: number;
  uploaded_by?: string;
  created_at: string;
}

const STORAGE_BUCKET = 'public';
const STORAGE_FOLDER = 'conference-galleries';

/**
 * Upload a conference image with automatic compression and thumbnail generation
 * 
 * @param file - Original image file
 * @param conferenceId - UUID of the conference
 * @param caption - Optional caption for the image
 * @returns Object with full and thumbnail URLs, or null on failure
 * @throws Error if upload fails or validation fails
 */
export async function uploadConferenceImage(
  file: File,
  albumId: string,
  caption?: string
): Promise<{ fullUrl: string; thumbUrl: string; fileSize: number } | null> {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image (JPEG, PNG, or WebP).');
    }

    // Validate file size (max 10MB original)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Original file size must be under 10MB.');
    }

    // Validate album ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(albumId)) {
      throw new Error('Invalid album ID format.');
    }

    console.log(`🖼️ Processing image: ${file.name} (${(file.size / 1024).toFixed(0)}KB)`);

    // Compress full-size image (1920px max, 85% quality)
    // Typical: 5MB photo → ~500KB (90% reduction, visually identical)
    const compressedFull = await compressImage(file, 1920, 0.85);
    
    // Create thumbnail (400px max, 75% quality)
    // Typical: ~50KB for gallery grid views
    const thumbnail = await createThumbnail(file, 400, 0.75);

    const fileExt = 'jpg'; // Always use JPEG after compression
    const timestamp = Date.now();
    const randomId = crypto.randomUUID();
    const baseFileName = `${STORAGE_FOLDER}/${albumId}/${timestamp}_${randomId}`;
    
    // Upload full-size compressed image
    console.log('📤 Uploading full-size image...');
    const { data: fullData, error: fullError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(`${baseFileName}.${fileExt}`, compressedFull, {
        cacheControl: '31536000', // 1 year cache
        upsert: false,
        contentType: 'image/jpeg'
      });

    if (fullError) {
      console.error('Upload error:', fullError);
      throw new Error(`Failed to upload image: ${fullError.message}`);
    }

    // Upload thumbnail
    console.log('📤 Uploading thumbnail...');
    const { data: thumbData, error: thumbError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(`${baseFileName}_thumb.${fileExt}`, thumbnail, {
        cacheControl: '31536000',
        upsert: false,
        contentType: 'image/jpeg'
      });

    if (thumbError) {
      // Cleanup full image if thumbnail upload fails
      await supabase.storage.from(STORAGE_BUCKET).remove([fullData.path]);
      throw new Error(`Failed to upload thumbnail: ${thumbError.message}`);
    }

    // Get public URLs
    const { data: { publicUrl: fullUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fullData.path);

    const { data: { publicUrl: thumbUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(thumbData.path);

    console.log('✅ Upload complete:', {
      original: `${(file.size / 1024).toFixed(0)}KB`,
      compressed: `${(compressedFull.size / 1024).toFixed(0)}KB`,
      thumbnail: `${(thumbnail.size / 1024).toFixed(0)}KB`
    });

    return {
      fullUrl,
      thumbUrl,
      fileSize: compressedFull.size
    };
  } catch (error) {
    console.error('Image upload failed:', error);
    throw error;
  }
}

/**
 * Get all gallery images for a specific album
 * 
 * @param albumId - UUID of the album
 * @returns Array of gallery images sorted by display order
 */
export async function getConferenceImages(albumId: string): Promise<GalleryImage[]> {
  try {
    const { data, error } = await supabase
      .from('conference_gallery_images')
      .select('*')
      .eq('album_id', albumId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch gallery images:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching conference images:', error);
    return [];
  }
}

/**
 * Delete a gallery image (removes from storage and database)
 * Admin-only operation (enforced by RLS)
 * 
 * @param imageId - UUID of the image to delete
 * @returns Success boolean
 */
export async function deleteConferenceImage(imageId: string): Promise<boolean> {
  try {
    // First, get the image record to find storage paths
    const { data: image, error: fetchError } = await supabase
      .from('conference_gallery_images')
      .select('image_url, thumbnail_url')
      .eq('id', imageId)
      .single();

    if (fetchError || !image) {
      throw new Error('Image not found.');
    }

    // Extract storage paths from URLs
    const extractPath = (url: string): string => {
      const match = url.match(/public\/(.+)$/);
      return match ? match[1] : '';
    };

    const fullPath = extractPath(image.image_url);
    const thumbPath = extractPath(image.thumbnail_url);

    // Delete from storage
    const pathsToDelete = [fullPath, thumbPath].filter(Boolean);
    if (pathsToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(pathsToDelete);

      if (storageError) {
        console.error('Failed to delete from storage:', storageError);
        // Continue with database deletion even if storage fails
      }
    }

    // Delete from database (RLS will check admin permission)
    const { error: deleteError } = await supabase
      .from('conference_gallery_images')
      .delete()
      .eq('id', imageId);

    if (deleteError) {
      throw new Error(`Failed to delete image: ${deleteError.message}`);
    }

    console.log('✅ Image deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
}

/**
 * Update image caption
 * Admin-only operation (enforced by RLS)
 * 
 * @param imageId - UUID of the image
 * @param caption - New caption text (sanitized)
 * @returns Success boolean
 */
export async function updateImageCaption(imageId: string, caption: string): Promise<boolean> {
  try {
    // Sanitize caption (max 500 chars, no HTML)
    const sanitizedCaption = caption
      .trim()
      .slice(0, 500)
      .replace(/<[^>]*>/g, ''); // Strip HTML tags

    const { error } = await supabase
      .from('conference_gallery_images')
      .update({ caption: sanitizedCaption })
      .eq('id', imageId);

    if (error) {
      throw new Error(`Failed to update caption: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error('Error updating caption:', error);
    throw error;
  }
}

/**
 * Reorder gallery images
 * Admin-only operation (enforced by RLS)
 * 
 * @param imageOrders - Array of {id, display_order} objects
 * @returns Success boolean
 */
export async function reorderImages(imageOrders: { id: string; display_order: number }[]): Promise<boolean> {
  try {
    // Update each image's display order
    const updates = imageOrders.map(({ id, display_order }) =>
      supabase
        .from('conference_gallery_images')
        .update({ display_order })
        .eq('id', id)
    );

    const results = await Promise.all(updates);
    
    const hasError = results.some(result => result.error);
    if (hasError) {
      throw new Error('Failed to reorder images.');
    }

    console.log('✅ Images reordered successfully');
    return true;
  } catch (error) {
    console.error('Error reordering images:', error);
    throw error;
  }
}

/**
 * Save gallery image metadata to database after upload
 * 
 * @param data - Image metadata
 * @returns Created image record
 */
export async function saveImageMetadata(data: {
  albumId: string;
  imageUrl: string;
  thumbnailUrl: string;
  originalFilename: string;
  fileSize: number;
  caption?: string;
  displayOrder?: number;
}): Promise<GalleryImage | null> {
  try {
    const { data: image, error } = await supabase
      .from('conference_gallery_images')
      .insert({
        album_id: data.albumId,
        image_url: data.imageUrl,
        thumbnail_url: data.thumbnailUrl,
        original_filename: data.originalFilename,
        file_size_bytes: data.fileSize,
        caption: data.caption || null,
        display_order: data.displayOrder ?? 0
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save image metadata: ${error.message}`);
    }

    return image;
  } catch (error) {
    console.error('Error saving image metadata:', error);
    throw error;
  }
}
