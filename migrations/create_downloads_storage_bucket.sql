-- Create storage policies for downloads bucket
-- Note: The bucket itself already exists and was created via Supabase Dashboard
-- This migration only creates the RLS policies for the bucket

-- APPLIED: 2025-10-27 via Supabase MCP execute_sql

-- Policy: Authenticated users can upload files to downloads bucket
CREATE POLICY "Authenticated users can upload to downloads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'downloads'
);

-- Policy: Public can view/download files (since bucket is public)
CREATE POLICY "Public can view downloads"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'downloads'
);

-- Policy: Authenticated users can delete files in downloads bucket
CREATE POLICY "Authenticated users can delete downloads"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'downloads'
);

-- NOTES:
-- 1. The downloads bucket is public, so files can be accessed via public URLs
-- 2. Any authenticated user can upload files
-- 3. Any authenticated user can delete files (consider restricting this in production)
-- 4. Public users can view/download files
-- 5. Files are organized by document ID: downloads/{documentId}/{timestamp}-{filename}

