-- Migration: Add Owners Table and Configurable Chunk Limits
-- This migration creates an owners table to manage document ownership
-- and allows per-owner customization of chunk retrieval limits
-- Date: October 2025

-- ============================================================================
-- STEP 1: Create the owners table
-- ============================================================================

CREATE TABLE IF NOT EXISTS owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    default_chunk_limit INTEGER NOT NULL DEFAULT 50 CHECK (default_chunk_limit > 0 AND default_chunk_limit <= 200),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS owners_slug_idx ON owners(slug);

-- Add comments for documentation
COMMENT ON TABLE owners IS 'Document owners with configurable RAG settings';
COMMENT ON COLUMN owners.slug IS 'URL-friendly identifier for the owner';
COMMENT ON COLUMN owners.default_chunk_limit IS 'Default number of chunks to retrieve for this owner''s documents (1-200)';
COMMENT ON COLUMN owners.metadata IS 'Additional owner configuration (e.g., branding, contact info)';

-- ============================================================================
-- STEP 2: Enable RLS and create policies for owners table
-- ============================================================================

ALTER TABLE owners ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read owners (for chunk limit lookups)
CREATE POLICY "Allow anonymous read owners" 
ON owners 
FOR SELECT 
TO anon 
USING (true);

-- Allow authenticated users to insert and update
CREATE POLICY "Allow authenticated insert owners" 
ON owners 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated update owners" 
ON owners 
FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access on owners"
ON owners
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- STEP 3: Add owner_id to documents table
-- ============================================================================

-- Add owner_id column
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES owners(id) ON DELETE SET NULL;

-- Create index on owner_id for performance
CREATE INDEX IF NOT EXISTS documents_owner_id_idx ON documents(owner_id);

-- Add comment
COMMENT ON COLUMN documents.owner_id IS 'Reference to owner (determines chunk limit and other settings)';

-- ============================================================================
-- STEP 4: Seed initial owners
-- ============================================================================

-- Insert default owners with different chunk limits
INSERT INTO owners (slug, name, description, default_chunk_limit, metadata) VALUES
(
    'ukidney',
    'UKidney Medical',
    'Medical nephrology documents requiring comprehensive context',
    50,
    '{"type": "medical", "specialty": "nephrology"}'::jsonb
),
(
    'maker-pizza',
    'Maker Pizza',
    'Restaurant training and operational documents',
    30,
    '{"type": "business", "industry": "food_service"}'::jsonb
),
(
    'default',
    'Default Owner',
    'Default owner for documents without specific ownership',
    50,
    '{"type": "general"}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 5: Migrate existing documents to owners
-- ============================================================================

-- Update existing documents based on their slug patterns
-- UKidney medical documents
UPDATE documents 
SET owner_id = (SELECT id FROM owners WHERE slug = 'ukidney')
WHERE owner_id IS NULL 
AND (
    slug LIKE 'smh%' 
    OR slug LIKE 'uhn%' 
    OR slug LIKE 'kdigo%' 
    OR slug LIKE 'ajkd%'
    OR slug = 'kk'
);

-- Maker Pizza documents
UPDATE documents 
SET owner_id = (SELECT id FROM owners WHERE slug = 'maker-pizza')
WHERE owner_id IS NULL 
AND slug LIKE 'maker%';

-- Set remaining documents to default owner
UPDATE documents 
SET owner_id = (SELECT id FROM owners WHERE slug = 'default')
WHERE owner_id IS NULL;

-- ============================================================================
-- STEP 6: Create helper function to get chunk limit for a document
-- ============================================================================

CREATE OR REPLACE FUNCTION get_document_chunk_limit(doc_slug TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    chunk_limit INTEGER;
BEGIN
    SELECT o.default_chunk_limit INTO chunk_limit
    FROM documents d
    JOIN owners o ON d.owner_id = o.id
    WHERE d.slug = doc_slug AND d.active = true;
    
    -- Return default if not found
    RETURN COALESCE(chunk_limit, 50);
END;
$$;

COMMENT ON FUNCTION get_document_chunk_limit IS 'Get the configured chunk limit for a document based on its owner';

-- ============================================================================
-- STEP 7: Create helper function to get chunk limit for multiple documents
-- ============================================================================

CREATE OR REPLACE FUNCTION get_multi_document_chunk_limit(doc_slugs TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    chunk_limit INTEGER;
    owner_count INTEGER;
BEGIN
    -- Check if all documents have the same owner
    SELECT COUNT(DISTINCT d.owner_id), MAX(o.default_chunk_limit)
    INTO owner_count, chunk_limit
    FROM documents d
    JOIN owners o ON d.owner_id = o.id
    WHERE d.slug = ANY(doc_slugs) AND d.active = true;
    
    -- If same owner, return their limit
    -- If different owners, return default (50)
    IF owner_count = 1 THEN
        RETURN COALESCE(chunk_limit, 50);
    ELSE
        RETURN 50;
    END IF;
END;
$$;

COMMENT ON FUNCTION get_multi_document_chunk_limit IS 'Get the chunk limit for multi-document queries (uses owner limit if all docs have same owner, otherwise default)';

-- ============================================================================
-- STEP 8: Create view for document-owner information
-- ============================================================================

CREATE OR REPLACE VIEW documents_with_owner AS
SELECT 
    d.id,
    d.slug,
    d.title,
    d.subtitle,
    d.back_link,
    d.welcome_message,
    d.pdf_filename,
    d.pdf_subdirectory,
    d.embedding_type,
    d.year,
    d.active,
    d.metadata as document_metadata,
    d.created_at,
    d.updated_at,
    o.id as owner_id,
    o.slug as owner_slug,
    o.name as owner_name,
    o.default_chunk_limit,
    o.metadata as owner_metadata
FROM documents d
LEFT JOIN owners o ON d.owner_id = o.id;

COMMENT ON VIEW documents_with_owner IS 'Convenient view joining documents with their owner information';

-- Grant access to the view
GRANT SELECT ON documents_with_owner TO anon;
GRANT SELECT ON documents_with_owner TO authenticated;
GRANT ALL ON documents_with_owner TO service_role;

-- ============================================================================
-- STEP 9: Create trigger to update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to owners table
DROP TRIGGER IF EXISTS update_owners_updated_at ON owners;
CREATE TRIGGER update_owners_updated_at
    BEFORE UPDATE ON owners
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to documents table (if not already exists)
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION QUERIES (for testing)
-- ============================================================================

-- Uncomment to verify the migration:
-- SELECT * FROM owners ORDER BY slug;
-- SELECT slug, title, owner_slug, owner_name, default_chunk_limit FROM documents_with_owner ORDER BY slug;
-- SELECT get_document_chunk_limit('smh');
-- SELECT get_document_chunk_limit('maker-foh');
-- SELECT get_multi_document_chunk_limit(ARRAY['smh', 'uhn']);
-- SELECT get_multi_document_chunk_limit(ARRAY['smh', 'maker-foh']);

