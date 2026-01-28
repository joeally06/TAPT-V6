/**
 * Image Compression Utility
 * 
 * Provides client-side image compression to reduce storage costs and bandwidth
 * while maintaining visual quality. Implements security validations.
 */

/**
 * Validates file is an allowed image type
 */
function validateImageType(file: File): boolean {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  return allowedTypes.includes(file.type.toLowerCase());
}

/**
 * Validates file size is within limits
 */
function validateFileSize(file: File, maxSizeMB: number = 10): boolean {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxBytes;
}

/**
 * Compresses an image file to reduce storage size while maintaining quality
 * 
 * @param file - Original image file
 * @param maxWidth - Maximum width in pixels (default 1920px for full-screen galleries)
 * @param quality - JPEG quality 0-1 (default 0.85 = excellent quality, ~70% size reduction)
 * @returns Compressed image file
 * @throws Error if image is invalid or processing fails
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1920,
  quality: number = 0.85
): Promise<File> {
  // Security validations
  if (!validateImageType(file)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
  }
  
  if (!validateFileSize(file, 10)) {
    throw new Error('File size exceeds 10MB limit.');
  }
  
  // Validate parameters
  if (maxWidth < 100 || maxWidth > 4000) {
    throw new Error('Max width must be between 100 and 4000 pixels.');
  }
  
  if (quality < 0.1 || quality > 1) {
    throw new Error('Quality must be between 0.1 and 1.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onerror = () => reject(new Error('Failed to read file.'));
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onerror = () => reject(new Error('Failed to load image. File may be corrupted.'));
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Scale down proportionally if larger than maxWidth
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context.'));
            return;
          }

          // Use high-quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image.'));
                return;
              }
              
              // Create new file with compressed data
              const compressedFile = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              
              console.log(`Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB (${((1 - compressedFile.size / file.size) * 100).toFixed(0)}% reduction)`);
              
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        } catch (err) {
          reject(new Error(`Image processing failed: ${err instanceof Error ? err.message : 'Unknown error'}`));
        }
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Generate a thumbnail for gallery previews
 * 
 * @param file - Original image file
 * @param maxWidth - Maximum width in pixels (default 400px for grid views)
 * @param quality - JPEG quality 0-1 (default 0.75 for thumbnails)
 * @returns Thumbnail image file
 * @throws Error if image is invalid or processing fails
 */
export async function createThumbnail(
  file: File,
  maxWidth: number = 400,
  quality: number = 0.75
): Promise<File> {
  return compressImage(file, maxWidth, quality);
}

/**
 * Batch compress multiple images
 * 
 * @param files - Array of image files
 * @param maxWidth - Maximum width for compressed images
 * @param quality - JPEG quality
 * @param onProgress - Optional callback for progress updates
 * @returns Array of compressed files
 */
export async function compressImages(
  files: File[],
  maxWidth: number = 1920,
  quality: number = 0.85,
  onProgress?: (current: number, total: number) => void
): Promise<File[]> {
  const compressed: File[] = [];
  
  for (let i = 0; i < files.length; i++) {
    try {
      const compressedFile = await compressImage(files[i], maxWidth, quality);
      compressed.push(compressedFile);
      onProgress?.(i + 1, files.length);
    } catch (error) {
      console.error(`Failed to compress ${files[i].name}:`, error);
      throw error;
    }
  }
  
  return compressed;
}
