-- Migration: Add Custom Domain Support to Owners
-- Created: 2025-01-24
-- Description: Add custom_domain column to owners table to support CNAME-based owner routing

-- =====================================================
-- Add custom_domain column to owners table
-- =====================================================

ALTER TABLE owners 
ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS owners_custom_domain_idx ON owners(custom_domain);

-- Add comment
COMMENT ON COLUMN owners.custom_domain IS 'Custom domain name (e.g., nephrology.ukidney.com) that routes to this owner. Must be unique across all owners.';

-- =====================================================
-- RLS Policies
-- =====================================================
-- Note: Existing RLS policies already allow anonymous read access to owners table
-- No additional policies needed for this column

-- =====================================================
-- Example Usage
-- =====================================================
-- UPDATE owners 
-- SET custom_domain = 'nephrology.ukidney.com' 
-- WHERE slug = 'ukidney';
