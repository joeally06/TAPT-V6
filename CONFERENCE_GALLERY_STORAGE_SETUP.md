# Conference Photo Gallery - Storage Bucket Setup

This document describes how to configure the Supabase Storage bucket for the conference photo gallery feature.

## Storage Bucket Configuration

### Using Existing "public" Bucket ✅
The gallery uses your existing **public** bucket with a dedicated **conference-galleries** folder inside it.

### Folder Structure
```
public/
└── conference-galleries/
    ├── {conference-id-1}/
    │   ├── {timestamp}_{uuid}.jpg
    │   ├── {timestamp}_{uuid}_thumb.jpg
    │   └── ...
    └── {conference-id-2}/
        └── ...
```

### Requirements

| Setting | Value | Description |
|---------|-------|-------------|
| **Bucket name** | `public` | Your existing public bucket |
| **Folder** | `conference-galleries` | Dedicated folder for gallery images |
| **Public access** | `true` | Images must be publicly accessible |
| **File size limit** | `10 MB` | Maximum size for uploaded images (before compression) |

## Setup Instructions

### ✅ Already Complete!

Since you're using the existing `public` bucket with a `conference-galleries` folder, no additional bucket setup is needed. The application will automatically:

1. Store images in: `public/conference-galleries/{conference-id}/`
2. Generate public URLs like: `https://{project}.supabase.co/storage/v1/object/public/public/conference-galleries/...`
3. Apply client-side compression before upload
4. Create both full-size and thumbnail versions

### Verify Folder Exists

1. Go to Supabase Dashboard → Storage → public bucket
2. Confirm `conference-galleries` folder exists
3. Set appropriate permissions if needed (should inherit from bucket)

## Storage Policies

The bucket should have these policies (already configured via database migration):

### 1. Public Read Access
- **Policy name**: "Gallery images are publicly readable"
- **Operation**: SELECT
- **Target roles**: anon, authenticated
- **Definition**: Allow all users to view images

### 2. Admin-Only Upload
- **Policy name**: "Only admins can upload gallery images"  
- **Operation**: INSERT
- **Target roles**: authenticated
- **Definition**: Only users with `role = 'admin'` in the `users` table

### 3. Admin-Only Delete
- **Policy name**: "Only admins can delete gallery images"
- **Operation**: DELETE
- **Target roles**: authenticated
- **Definition**: Only users with `role = 'admin'` in the `users` table

## Detailed Folder Structure

Images are organized by conference ID inside the `conference-galleries` folder:

```
public/
└── conference-galleries/
    ├── {conference-id-1}/
    │   ├── {timestamp}_{uuid}.jpg          (full-size compressed ~500KB)
    │   ├── {timestamp}_{uuid}_thumb.jpg    (thumbnail ~50KB)
    │   └── ...
    └── {conference-id-2}/
        └── ...
```

Example:
```
public/
└── conference-galleries/
    └── 123e4567-e89b-12d3-a456-426614174000/
        ├── 1706380800000_a1b2c3d4.jpg
        ├── 1706380800000_a1b2c3d4_thumb.jpg
        ├── 1706381200000_e5f6g7h8.jpg
        └── 1706381200000_e5f6g7h8_thumb.jpg
```

## Compression Details

### Client-Side Processing
All images are compressed in the browser before upload:

| Image Type | Max Dimensions | Quality | Typical Size |
|------------|---------------|---------|--------------|
| **Full-size** | 1920px width | 85% | ~500 KB |
| **Thumbnail** | 400px width | 75% | ~50 KB |

### Storage Savings Example
- **Original file**: 5 MB
- **After compression**: 550 KB (full + thumb)
- **Savings**: ~89%

For 100 photos:
- **Without compression**: 500 MB
- **With compression**: ~55 MB
- **Savings**: 445 MB (89%)

## CDN & Caching

### Automatic CDN
Supabase Storage uses Cloudflare CDN for global distribution:
- Images are cached at edge locations worldwide
- First request fetches from origin
- Subsequent requests served from nearest edge location
- Automatic cache invalidation when files are deleted/updated

### Cache Control Headers
Set in upload configuration:
```typescript
{
  cacheControl: '31536000' // 1 year in seconds
}
```

## Security Considerations

### ✅ Implemented Protections

1. **File Type Validation**
   - Client-side: JavaScript MIME type check
   - Server-side: Bucket-level MIME type restrictions

2. **File Size Limits**
   - Client-side: 10 MB check before processing
   - Bucket-level: 10 MB hard limit

3. **Access Control**
   - RLS policies enforce admin-only uploads/deletes
   - Public read access only

4. **Input Sanitization**
   - Caption text: HTML stripped, 500 char max
   - Filenames: Generated server-side (timestamp + UUID)
   - No user-provided filenames accepted

5. **Rate Limiting**
   - Supabase built-in rate limits apply
   - Additional application-level limits can be added if needed

### ❌ Potential Risks

1. **Storage Costs**
   - Monitor bucket usage regularly
   - Consider implementing cleanup of old/unused images
   - Supabase free tier: 1 GB storage

2. **Malicious Files**
   - MIME type restrictions help but are not foolproof
   - Consider adding virus scanning for production use
   - Bucket is public - don't store sensitive images

## Monitoring & Maintenance

### Check Storage Usage
folder
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size')::bigint as total_bytes,
  pg_size_pretty(SUM((metadata->>'size')::bigint)::bigint) as total_size
FROM storage.objects
WHERE bucket_id = 'public'
  AND name LIKE 'conference-galleries/%'
GROUP BY bucket_id;
```

### List All Images for a Conference

```sql
SELECT 
  name,
  metadata->>'size' as size_bytes,
  created_at
FROM storage.objects
WHERE bucket_id = 'public'
  AND name LIKE 'conference-galleries/{conference-id}/%'
ORDER BY created_at DESC;
```

### Clean Up Old Conference Images

```sql
-- Delete all images for a specific conference
-- (Use carefully - this is permanent!)
DELETE FROM storage.objects
WHERE bucket_id = 'public'
  AND name LIKE 'conference-galleries/ge.objects
WHERE bucket_id = 'conference-galleries'
  AND name LIKE '{conference-id}/%';
```

## Troubleshooting

### Images Not Uploading
public bucket exists: `SELECT * FROM storage.buckets WHERE id = 'public'`
2. Verify bucket is public: Bucket should have `public = true`
3. Check folder exists: Navigate to Storage → public → conference-galleries
4. Check RLS policies: User must have `role = 'admin'`
5. Verify MIME types: File type must be JPEG, PNG, or WebP

### Images Not Displaying

1. Check bucket is public
2. Verify image URL is correct format:
   ```
   https://{project}.supabase.co/storage/v1/object/public/public/conference-galleries/{conference-id}/{filename}.jpg
   ```
3. Check browser console for CORS errors
4. Verify database record exists in `conference_gallery_images`
5. Confirm folder path is correct in Storage dashboard
4. Verify database record exists in `conference_gallery_images`

### Performance Issues

1. Enable CDN caching (should be automatic)
2. Use thumbnails for grid views (already implemented)
3. Implement lazy loading (already implemented)
4. Consider image optimization service for very high traffic

## Cost Estimates

### Supabase Pricing (as of 2026)

| Tier | Storage | Bandwidth | Cost |
|------|---------|-----------|------|
| **Free** | 1 GB | 2 GB/month | $0 |
| **Pro** | 100 GB | 200 GB/month | $25/month |

### Storage Calculator

| Photos | Avg Size | Total Storage |
|--------|----------|---------------|
| 100 | 550 KB | 55 MB |
| 500 | 550 KB | 275 MB |
| 1,000 | 550 KB | 550 MB |
| 1,800 | 550 KB | 1 GB (free tier limit) |

**Recommendation**: Free tier should handle 1,500-2,000 photos comfortably.

## Migration Notes

If migrating from another storage solution:

1. Download existing images
2. Process through compression utilities
3. Upload to new bucket with proper naming convention
4. Update database records with new URLs
5. Test public access
6. Delete old storage

## Related Documentation

- [Database Migration](../supabase/migrations/20260127175253_create_conference_gallery.sql) - Table schema and RLS policies
- [Image Compression Library](../src/lib/imageCompression.ts) - Client-side compression utilities
- [Gallery Management](../src/lib/conferenceGallery.ts) - Upload/delete functions
- [Admin Component](../src/pages/AdminConferenceGallery.tsx) - Gallery management interface
- [Public Component](../src/components/ConferenceGallery.tsx) - Public gallery display
