-- Migration: Add processing_method column to user_documents
-- Created: 2025-01-XX
-- Description: Track which processing method was used (edge_function or vps) for fallback tracking

-- Add processing_method column to track which system processed the document
ALTER TABLE user_documents 
ADD COLUMN IF NOT EXISTS processing_method TEXT DEFAULT 'vps' CHECK (processing_method IN ('vps', 'edge_function'));

-- Add index for querying by processing method
CREATE INDEX IF NOT EXISTS idx_user_documents_processing_method ON user_documents(processing_method);

-- Add comment for documentation
COMMENT ON COLUMN user_documents.processing_method IS 'Tracks which processing system was used: vps (default) or edge_function';

