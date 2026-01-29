# Conference Photo Albums - User Guide

## Overview

The photo album system allows you to organize conference photos by **name** and **year**, independent of the full conference settings. This makes it easy to upload historical photos without needing complete conference details.

## Key Features

- **Simple Album Creation**: Just provide a name, year, and optional description
- **Flexible Organization**: Not tied to conference_settings table
- **Easy Management**: Create, edit, and delete albums from one place
- **Public Visibility Toggle**: Show/hide albums from public view
- **Direct Photo Management**: Click "Manage Photos" to jump directly to gallery management

## How to Use

### 1. Create a Photo Album

1. Navigate to **Admin → Photo Albums**
2. Click **+ Create Album**
3. Fill in:
   - **Album Name**: e.g., "Annual Conference", "Summer Workshop"
   - **Year**: 1900-2100
   - **Description** (Optional): Brief description of the event
4. Click **Create Album**

### 2. Upload Photos to an Album

**Option A: From Photo Albums Page**
1. Find your album in the list
2. Click **Manage Photos**
3. Upload images using the file selector
4. Photos are automatically compressed (5MB → ~550KB)

**Option B: From Gallery Management Page**
1. Navigate to **Admin → Gallery Management**
2. Select album from dropdown
3. Upload images

### 3. Manage Albums

**Edit an Album**:
- Click **Edit** next to the album
- Update name, year, or description
- Click **Save**

**Toggle Visibility**:
- Click the **Visible/Hidden** badge
- Hidden albums won't appear on the public gallery page

**Delete an Album**:
- Click **Delete** next to the album
- Confirm deletion (this removes all photos in the album)

### 4. Public Gallery

Visitors can view albums by:
1. Going to **Forms → Conference Gallery**
2. Selecting an album from the dropdown (shows Year - Name)
3. Browsing photos in a responsive grid
4. Clicking photos to open lightbox view

## Examples

**Historical Photos**:
```
Name: "1985 Founding Conference"
Year: 1985
Description: "Our inaugural event in Nashville, TN"
```

**Recent Event**:
```
Name: "2025 Annual Conference"
Year: 2025
Description: "Held at the Opryland Hotel, Nashville"
```

**Multi-Event Year**:
```
Name: "Summer Safety Workshop"
Year: 2024
Description: "Special training event in Memphis"
```

## Database Migration

Apply the migration to create the photo_albums table:

```sql
-- Via Supabase Dashboard SQL Editor
-- Run: supabase/migrations/20260128000100_create_photo_albums.sql
```

This migration:
- Creates `conference_photo_albums` table
- Migrates existing gallery images from `conference_settings`
- Renames `conference_id` to `album_id` in gallery images
- Sets up RLS policies for public read, admin write

## Technical Notes

- **Storage**: Uses existing "public" bucket with "conference-galleries" folder
- **Path Pattern**: `public/conference-galleries/{album-id}/{timestamp}_{uuid}.jpg`
- **Compression**: Client-side compression reduces storage by ~90%
- **Security**: Admin-only upload via RLS, public read for visible albums
- **Cascading Deletes**: Deleting an album removes all associated photos

## Navigation Structure

**Admin Menu**:
- Photo Albums → Create and manage albums
- Gallery Management → Upload photos to existing albums

**Public Menu**:
- Conference Gallery → View photos organized by year and album name
