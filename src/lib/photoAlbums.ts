/**
 * Conference Photo Album Management
 * 
 * Manages photo albums with name and year for organizing conference photos.
 * Independent of conference_settings for maximum flexibility.
 */

import { supabase } from './supabase';

export interface PhotoAlbum {
  id: string;
  name: string;
  year: number;
  description: string | null;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get all visible photo albums (public access)
 * @returns Array of visible albums sorted by year descending
 */
export async function getVisibleAlbums(): Promise<PhotoAlbum[]> {
  try {
    const { data, error } = await supabase
      .from('conference_photo_albums')
      .select('*')
      .eq('is_visible', true)
      .order('year', { ascending: false })
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch albums:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching albums:', error);
    return [];
  }
}

/**
 * Get all photo albums (admin access)
 * @returns Array of all albums sorted by year descending
 */
export async function getAllAlbums(): Promise<PhotoAlbum[]> {
  try {
    const { data, error } = await supabase
      .from('conference_photo_albums')
      .select('*')
      .order('year', { ascending: false })
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch albums:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching albums:', error);
    return [];
  }
}

/**
 * Create a new photo album
 * @param name - Album name (e.g., "2024 Annual Conference")
 * @param year - Year (1900-2100)
 * @param description - Optional description
 * @returns Created album or null on failure
 */
export async function createAlbum(
  name: string,
  year: number,
  description?: string
): Promise<PhotoAlbum | null> {
  try {
    if (!name.trim()) {
      throw new Error('Album name is required');
    }

    if (year < 1900 || year > 2100) {
      throw new Error('Year must be between 1900 and 2100');
    }

    const { data, error } = await supabase
      .from('conference_photo_albums')
      .insert({
        name: name.trim(),
        year,
        description: description?.trim() || null,
        is_visible: true,
        display_order: 0
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`An album named "${name}" for year ${year} already exists.`);
      }
      throw new Error(`Failed to create album: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error creating album:', error);
    throw error;
  }
}

/**
 * Update an existing album
 * @param id - Album ID
 * @param updates - Fields to update
 * @returns Updated album or null on failure
 */
export async function updateAlbum(
  id: string,
  updates: Partial<Pick<PhotoAlbum, 'name' | 'year' | 'description' | 'is_visible'>>
): Promise<PhotoAlbum | null> {
  try {
    const { data, error } = await supabase
      .from('conference_photo_albums')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update album: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error updating album:', error);
    throw error;
  }
}

/**
 * Delete a photo album (cascades to all photos in album)
 * @param id - Album ID
 * @returns Success boolean
 */
export async function deleteAlbum(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('conference_photo_albums')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete album: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting album:', error);
    return false;
  }
}

/**
 * Get photo count for an album
 * @param albumId - Album ID
 * @returns Number of photos in album
 */
export async function getAlbumPhotoCount(albumId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('conference_gallery_images')
      .select('*', { count: 'exact', head: true })
      .eq('album_id', albumId);

    if (error) {
      console.error('Failed to count photos:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error counting photos:', error);
    return 0;
  }
}
