-- Migration: Add chunk_limit_override column to documents table
-- Date: 2025-10-21
-- Description: Adds optional per-document chunk limit override

-- Add the chunk_limit_override column if it doesn't exist
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS chunk_limit_override INTEGER
CHECK (chunk_limit_override IS NULL OR (chunk_limit_override > 0 AND chunk_limit_override <= 200));

-- Add column comment for documentation
COMMENT ON COLUMN documents.chunk_limit_override IS 'Optional override for chunk limit (1-200). If set, overrides the owner default. If null, uses owner default.';

-- Example usage:
-- Override for specific document:
-- UPDATE documents
-- SET chunk_limit_override = 25
-- WHERE slug = 'specific-document';

-- Remove override (back to owner default):
-- UPDATE documents
-- SET chunk_limit_override = NULL
-- WHERE slug = 'specific-document';
