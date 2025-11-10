-- Migration: Normalize categories into a dedicated table
-- This replaces the TEXT column approach with proper referential integrity
-- Date: 2025-11-10

-- ============================================================================
-- STEP 1: Create the categories table
-- ============================================================================

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    is_custom BOOLEAN DEFAULT false,
    owner_id UUID REFERENCES owners(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    -- Ensure unique category names per owner (NULL owner_id = system default)
    CONSTRAINT unique_category_per_owner UNIQUE (name, owner_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS categories_name_idx ON categories(name);
CREATE INDEX IF NOT EXISTS categories_owner_id_idx ON categories(owner_id);
CREATE INDEX IF NOT EXISTS categories_is_custom_idx ON categories(is_custom);

-- Add comments for documentation
COMMENT ON TABLE categories IS 'Normalized table for document categories with referential integrity';
COMMENT ON COLUMN categories.name IS 'Category name (e.g., "Guidelines", "Training")';
COMMENT ON COLUMN categories.is_custom IS 'Whether this is a custom category (not a system default)';
COMMENT ON COLUMN categories.owner_id IS 'Owner-specific category (NULL = system default, available to all)';
COMMENT ON COLUMN categories.created_by IS 'User who created this category';
COMMENT ON COLUMN categories.updated_by IS 'User who last updated this category';

-- ============================================================================
-- STEP 2: Enable RLS and create policies
-- ============================================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated users to read categories
CREATE POLICY "Allow read access to categories" 
ON categories 
FOR SELECT 
TO anon, authenticated
USING (true);

-- Allow authenticated users to insert custom categories
CREATE POLICY "Allow authenticated insert categories" 
ON categories 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update categories they created
CREATE POLICY "Allow authenticated update own categories" 
ON categories 
FOR UPDATE 
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Allow service role full access
CREATE POLICY "Allow service role full access on categories"
ON categories
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- STEP 3: Migrate existing categories from system_config
-- ============================================================================

-- Insert default categories from system_config
INSERT INTO categories (name, is_custom, owner_id, created_at, updated_at)
SELECT 
    category_name::TEXT as name,
    false as is_custom,
    NULL as owner_id,
    NOW() as created_at,
    NOW() as updated_at
FROM (
    SELECT jsonb_array_elements_text(value) as category_name
    FROM system_config
    WHERE key = 'default_categories'
) AS default_cats
ON CONFLICT (name, owner_id) DO NOTHING;

-- ============================================================================
-- STEP 4: Migrate owner-specific categories from owners.metadata
-- ============================================================================

-- Insert owner-specific categories
INSERT INTO categories (name, is_custom, owner_id, created_at, updated_at)
SELECT 
    category_name::TEXT as name,
    true as is_custom,
    o.id as owner_id,
    NOW() as created_at,
    NOW() as updated_at
FROM owners o,
     jsonb_array_elements_text(o.metadata->'categories') as category_name
WHERE o.metadata->'categories' IS NOT NULL
  AND jsonb_array_length(o.metadata->'categories') > 0
ON CONFLICT (name, owner_id) DO NOTHING;

-- ============================================================================
-- STEP 5: Migrate existing document categories (create missing ones)
-- ============================================================================

-- Insert any categories found in documents that don't exist yet
INSERT INTO categories (name, is_custom, owner_id, created_at, updated_at)
SELECT DISTINCT
    d.category as name,
    true as is_custom, -- Mark as custom since they weren't in defaults
    d.owner_id as owner_id,
    NOW() as created_at,
    NOW() as updated_at
FROM documents d
WHERE d.category IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM categories c 
      WHERE c.name = d.category 
      AND (c.owner_id = d.owner_id OR (c.owner_id IS NULL AND d.owner_id IS NULL))
  )
ON CONFLICT (name, owner_id) DO NOTHING;

-- ============================================================================
-- STEP 6: Add category_id column to documents table
-- ============================================================================

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS documents_category_id_idx ON documents(category_id);

-- Add comment
COMMENT ON COLUMN documents.category_id IS 'Reference to category in normalized categories table';

-- ============================================================================
-- STEP 7: Migrate existing documents.category values to category_id
-- ============================================================================

-- Update documents to use category_id based on category name and owner
UPDATE documents d
SET category_id = c.id
FROM categories c
WHERE d.category IS NOT NULL
  AND d.category = c.name
  AND (
    -- Match owner-specific category
    (d.owner_id IS NOT NULL AND c.owner_id = d.owner_id)
    OR
    -- Match system default category (when document has no owner or category has no owner)
    (c.owner_id IS NULL AND (d.owner_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM categories c2 
        WHERE c2.name = d.category 
        AND c2.owner_id = d.owner_id
    )))
  )
  AND d.category_id IS NULL;

-- For documents with categories that couldn't be matched, use the first matching category by name
-- (fallback for edge cases)
UPDATE documents d
SET category_id = (
    SELECT c.id 
    FROM categories c 
    WHERE c.name = d.category 
    AND c.owner_id IS NULL
    LIMIT 1
)
WHERE d.category IS NOT NULL
  AND d.category_id IS NULL
  AND EXISTS (
      SELECT 1 FROM categories c 
      WHERE c.name = d.category 
      AND c.owner_id IS NULL
  );

-- ============================================================================
-- STEP 8: Create helper function to get categories for an owner
-- ============================================================================

CREATE OR REPLACE FUNCTION get_categories_for_owner(p_owner_id UUID DEFAULT NULL)
RETURNS TABLE (
    id INTEGER,
    name TEXT,
    is_custom BOOLEAN,
    owner_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.is_custom,
        c.owner_id
    FROM categories c
    WHERE 
        -- System defaults (available to all)
        c.owner_id IS NULL
        OR
        -- Owner-specific categories
        c.owner_id = p_owner_id
    ORDER BY 
        c.owner_id NULLS FIRST, -- System defaults first
        c.name;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_categories_for_owner IS 'Returns all categories available for a given owner (system defaults + owner-specific)';

-- ============================================================================
-- STEP 9: Create trigger to update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_categories_updated_at();

