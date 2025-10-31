-- Migration: Add uploaded_by_user_id to documents table
-- Created: 2025-01-XX
-- Description: Track which user uploaded each document, especially useful for super admins viewing all documents

-- Add uploaded_by_user_id column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS uploaded_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS documents_uploaded_by_user_id_idx ON documents(uploaded_by_user_id);

-- Add comment
COMMENT ON COLUMN documents.uploaded_by_user_id IS 'User ID who uploaded this document. Set for all user-uploaded documents. NULL for documents uploaded via batch scripts or super admins who choose not to set an owner.';

