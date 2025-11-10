-- Migration: Drop deprecated category column
-- This column has been fully replaced by category_id
-- Date: 2025-01-XX

-- Drop the deprecated category column from documents table
ALTER TABLE documents DROP COLUMN IF EXISTS category;

-- Add comment documenting the removal
COMMENT ON TABLE documents IS 'Document registry table. Category information is stored via category_id foreign key to categories table.';

