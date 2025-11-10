-- Migration: Add system_config table for storing system-wide configuration
-- This allows super admins to configure default categories and other system settings
-- Date: 2025-01-XX

-- ============================================================================
-- STEP 1: Create the system_config table
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Create index on key for fast lookups
CREATE INDEX IF NOT EXISTS system_config_key_idx ON system_config(key);

-- Add comments for documentation
COMMENT ON TABLE system_config IS 'System-wide configuration settings stored as key-value pairs with JSONB values';
COMMENT ON COLUMN system_config.key IS 'Unique configuration key identifier';
COMMENT ON COLUMN system_config.value IS 'Configuration value stored as JSONB (can be array, object, or primitive)';
COMMENT ON COLUMN system_config.description IS 'Human-readable description of what this configuration setting does';
COMMENT ON COLUMN system_config.version IS 'Version number for tracking schema changes over time';
COMMENT ON COLUMN system_config.created_by IS 'User who created this configuration entry';
COMMENT ON COLUMN system_config.updated_by IS 'User who last updated this configuration entry';

-- ============================================================================
-- STEP 2: Enable RLS and create policies
-- ============================================================================

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated users to read configs (for fetching default categories)
CREATE POLICY "Allow read access to system_config" 
ON system_config 
FOR SELECT 
TO anon, authenticated
USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access on system_config"
ON system_config
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- STEP 3: Insert initial default categories configuration
-- ============================================================================

INSERT INTO system_config (key, value, description, version) VALUES (
    'default_categories',
    '["Guidelines", "Maker", "Manuals", "Presentation", "Recipes", "Reviews", "Slides", "Training"]'::jsonb,
    'Default category options available for documents when owner-specific categories are not set',
    1
) ON CONFLICT (key) DO NOTHING;

