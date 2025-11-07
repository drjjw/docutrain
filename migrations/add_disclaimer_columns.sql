-- Migration: Add disclaimer columns to documents table
-- Date: 2025-01-27
-- Description: Adds show_disclaimer and disclaimer_text columns to enable per-document disclaimer configuration

-- Add the disclaimer columns if they don't exist
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS show_disclaimer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS disclaimer_text TEXT CHECK (disclaimer_text IS NULL OR char_length(disclaimer_text) <= 10000);

-- Add column comments for documentation
COMMENT ON COLUMN documents.show_disclaimer IS 'Whether to show a disclaimer modal for this document';
COMMENT ON COLUMN documents.disclaimer_text IS 'Custom disclaimer text (max 10000 chars). If NULL, uses generic default disclaimer text.';

-- Migrate existing ukidney documents to use the new disclaimer system
-- Set show_disclaimer = true and preserve their current disclaimer text
UPDATE documents 
SET show_disclaimer = true,
    disclaimer_text = 'This feature is intended for educational use only by healthcare professionals. Please verify all suggestions before considering use in patient care settings. If you agree with these terms, please acknowledge below, otherwise you will be redirected.'
WHERE owner = 'ukidney';

