-- Migration: Add metadata column to user_documents table
-- Created: 2025-11-05
-- Description: Add JSONB metadata column to store text content and other upload metadata

-- Add metadata column to user_documents table
ALTER TABLE user_documents
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN user_documents.metadata IS 'JSONB metadata for document uploads (e.g., text content for text uploads, processing options)';

-- Add index for querying by metadata fields
CREATE INDEX IF NOT EXISTS idx_user_documents_metadata ON user_documents USING gin(metadata);