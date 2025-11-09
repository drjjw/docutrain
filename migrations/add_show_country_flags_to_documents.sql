-- Migration: Add Show Country Flags Option to Documents
-- Adds option to show/hide country flags in recent questions (only applies when show_recent_questions is enabled)
-- Date: 2025-01-XX

-- Add show_country_flags BOOLEAN column (defaults to false)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS show_country_flags BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN documents.show_country_flags IS 'Show country flags next to recent questions. Only applies when show_recent_questions is enabled. Defaults to false.';

