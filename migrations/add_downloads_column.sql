-- Migration: Add downloads column to documents table
-- Date: 2025-10-20
-- Description: Adds a JSONB column to store downloadable file URLs for each document

-- Add the downloads column if it doesn't exist
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS downloads JSONB;

-- Set default value for the column
ALTER TABLE documents 
ALTER COLUMN downloads SET DEFAULT '[]'::jsonb;

-- Update existing NULL values to empty array
UPDATE documents 
SET downloads = '[]'::jsonb 
WHERE downloads IS NULL;

-- Add column comment for documentation
COMMENT ON COLUMN documents.downloads IS 'Array of download links with title and url. Example: [{"title": "PDF Version", "url": "https://example.com/file.pdf"}]';

-- Example usage:
-- Single download:
-- UPDATE documents 
-- SET downloads = '[{"title": "Download PDF", "url": "https://example.com/document.pdf"}]'::jsonb
-- WHERE slug = 'document-slug';

-- Multiple downloads:
-- UPDATE documents 
-- SET downloads = '[
--   {"title": "PDF", "url": "https://example.com/doc.pdf"},
--   {"title": "EPUB", "url": "https://example.com/doc.epub"}
-- ]'::jsonb
-- WHERE slug = 'document-slug';


