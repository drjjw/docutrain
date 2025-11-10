-- Migration: Change category from ENUM to TEXT to allow custom categories
-- This allows users to create custom categories beyond the predefined list

-- First, change the column type from enum to text
ALTER TABLE documents
ALTER COLUMN category TYPE text
USING category::text;

-- Drop the enum type if it's no longer used elsewhere
-- (We'll keep it commented out in case it's referenced elsewhere)
-- DROP TYPE IF EXISTS document_category;

-- Update comment to reflect that custom categories are now allowed
COMMENT ON COLUMN documents.category IS 'Document category for organization and filtering purposes. Can be any text value, including custom categories.';

