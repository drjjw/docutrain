-- Migration: Scalable Document Registry System
-- This migration transforms hardcoded document configuration into a database-backed registry
-- Date: October 2025

-- ============================================================================
-- STEP 1: Create the documents registry table
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    back_link TEXT,
    welcome_message TEXT NOT NULL,
    pdf_filename TEXT NOT NULL,
    pdf_subdirectory TEXT NOT NULL,
    embedding_type TEXT NOT NULL CHECK (embedding_type IN ('openai', 'local')),
    year TEXT,
    active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS documents_slug_idx ON documents(slug);
CREATE INDEX IF NOT EXISTS documents_active_idx ON documents(active);
CREATE INDEX IF NOT EXISTS documents_embedding_type_idx ON documents(embedding_type);

-- Add comments for documentation
COMMENT ON TABLE documents IS 'Central registry of all documents available in the chatbot system';
COMMENT ON COLUMN documents.slug IS 'URL-friendly identifier used in ?doc= parameter';
COMMENT ON COLUMN documents.pdf_subdirectory IS 'Subdirectory within /PDFs/ (e.g., manuals, guidelines)';
COMMENT ON COLUMN documents.embedding_type IS 'Which embedding system to use: openai (1536D) or local (384D)';
COMMENT ON COLUMN documents.active IS 'Whether this document is available for queries';

-- ============================================================================
-- STEP 2: Enable RLS and create policies for documents table
-- ============================================================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read active documents only
CREATE POLICY "Allow anonymous read active documents" 
ON documents 
FOR SELECT 
TO anon 
USING (active = true);

-- Allow authenticated users to insert and update
CREATE POLICY "Allow authenticated insert documents" 
ON documents 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated update documents" 
ON documents 
FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access on documents"
ON documents
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- STEP 3: Update document_chunks table to use slugs
-- ============================================================================

-- First, backup the check constraint name (it may vary)
-- We'll drop and recreate without the restrictive constraint

-- Add the new slug column
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS document_slug TEXT;

-- Migrate existing data: map old document_type to new slug
UPDATE document_chunks 
SET document_slug = document_type 
WHERE document_slug IS NULL;

-- Drop the old restrictive CHECK constraint if it exists
DO $$ 
BEGIN
    -- Try to drop constraint (may have different name)
    ALTER TABLE document_chunks DROP CONSTRAINT IF EXISTS document_chunks_document_type_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Make document_slug NOT NULL after migration
ALTER TABLE document_chunks 
ALTER COLUMN document_slug SET NOT NULL;

-- Add foreign key to documents table
ALTER TABLE document_chunks
ADD CONSTRAINT document_chunks_document_slug_fkey 
FOREIGN KEY (document_slug) REFERENCES documents(slug) 
ON DELETE CASCADE;

-- Create index on document_slug (replace old document_type index)
DROP INDEX IF EXISTS document_chunks_document_type_idx;
CREATE INDEX IF NOT EXISTS document_chunks_document_slug_idx 
ON document_chunks(document_slug);

-- Update unique constraint to use slug
ALTER TABLE document_chunks 
DROP CONSTRAINT IF EXISTS document_chunks_document_type_chunk_index_key;

ALTER TABLE document_chunks
ADD CONSTRAINT document_chunks_document_slug_chunk_index_key 
UNIQUE(document_slug, chunk_index);

-- ============================================================================
-- STEP 4: Update document_chunks_local table to use slugs
-- ============================================================================

-- Add the new slug column
ALTER TABLE document_chunks_local 
ADD COLUMN IF NOT EXISTS document_slug TEXT;

-- Migrate existing data
UPDATE document_chunks_local 
SET document_slug = document_type 
WHERE document_slug IS NULL;

-- Drop the old restrictive CHECK constraint
DO $$ 
BEGIN
    ALTER TABLE document_chunks_local DROP CONSTRAINT IF EXISTS document_chunks_local_document_type_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Make document_slug NOT NULL
ALTER TABLE document_chunks_local 
ALTER COLUMN document_slug SET NOT NULL;

-- Add foreign key
ALTER TABLE document_chunks_local
ADD CONSTRAINT document_chunks_local_document_slug_fkey 
FOREIGN KEY (document_slug) REFERENCES documents(slug) 
ON DELETE CASCADE;

-- Create index on document_slug
DROP INDEX IF EXISTS document_chunks_local_document_type_idx;
CREATE INDEX IF NOT EXISTS document_chunks_local_document_slug_idx 
ON document_chunks_local(document_slug);

-- Update unique constraint
ALTER TABLE document_chunks_local 
DROP CONSTRAINT IF EXISTS document_chunks_local_document_type_chunk_index_key;

ALTER TABLE document_chunks_local
ADD CONSTRAINT document_chunks_local_document_slug_chunk_index_key 
UNIQUE(document_slug, chunk_index);

-- ============================================================================
-- STEP 5: Update match_document_chunks function to use slug
-- ============================================================================

CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding vector(1536),
    doc_slug TEXT,
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    document_slug TEXT,
    document_name TEXT,
    chunk_index INTEGER,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        document_chunks.id,
        document_chunks.document_slug,
        document_chunks.document_name,
        document_chunks.chunk_index,
        document_chunks.content,
        document_chunks.metadata,
        1 - (document_chunks.embedding <=> query_embedding) AS similarity
    FROM document_chunks
    WHERE document_chunks.document_slug = doc_slug
        AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
    ORDER BY document_chunks.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_document_chunks IS 'Similarity search for RAG retrieval using document slug';

-- ============================================================================
-- STEP 6: Update match_document_chunks_local function to use slug
-- ============================================================================

CREATE OR REPLACE FUNCTION match_document_chunks_local(
    query_embedding vector(384),
    doc_slug TEXT,
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    document_slug TEXT,
    document_name TEXT,
    chunk_index INTEGER,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        document_chunks_local.id,
        document_chunks_local.document_slug,
        document_chunks_local.document_name,
        document_chunks_local.chunk_index,
        document_chunks_local.content,
        document_chunks_local.metadata,
        1 - (document_chunks_local.embedding <=> query_embedding) AS similarity
    FROM document_chunks_local
    WHERE document_chunks_local.document_slug = doc_slug
        AND 1 - (document_chunks_local.embedding <=> query_embedding) > match_threshold
    ORDER BY document_chunks_local.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_document_chunks_local IS 'Similarity search for RAG retrieval using document slug (local embeddings)';

-- ============================================================================
-- STEP 7: Seed initial documents
-- ============================================================================

-- Insert the three existing documents
INSERT INTO documents (slug, title, subtitle, back_link, welcome_message, pdf_filename, pdf_subdirectory, embedding_type, year, active, metadata) VALUES
(
    'smh',
    'Nephrology Manual',
    'St. Michael''s Hospital · Interactive search and consultation',
    'https://brightbean.io/nephrology-publications/nephrology-manuals/st-michael-s-hospital-nephrology-manual',
    'SMH Housestaff Manual',
    'smh-manual-2023.pdf',
    'manuals',
    'openai',
    '2023',
    true,
    '{"institution": "St. Michael''s Hospital", "department": "Nephrology", "version": "2023"}'::jsonb
),
(
    'uhn',
    'Nephrology Manual',
    'University Health Network · Interactive search and consultation',
    'https://brightbean.io/nephrology-publications/nephrology-manuals/university-health-network-nephrology-manual',
    'UHN Nephrology Manual',
    'uhn-manual-2025.pdf',
    'manuals',
    'openai',
    '2025',
    true,
    '{"institution": "University Health Network", "department": "Nephrology", "version": "2025"}'::jsonb
),
(
    'CKD-dc-2025',
    'CKD in Diabetes Guidelines',
    'Diabetes Canada Clinical Practice Guideline 2025 · Interactive search and consultation',
    'https://brightbean.io/nephrology-publications/nephrology-manuals/ckd-diabetes-guidelines-2025',
    'CKD in Diabetes: Clinical Practice Guideline 2025',
    'PIIS1499267125000206.pdf',
    'guidelines',
    'local',
    '2025',
    true,
    '{"organization": "Diabetes Canada", "type": "Clinical Practice Guideline", "version": "2025"}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    back_link = EXCLUDED.back_link,
    welcome_message = EXCLUDED.welcome_message,
    pdf_filename = EXCLUDED.pdf_filename,
    pdf_subdirectory = EXCLUDED.pdf_subdirectory,
    embedding_type = EXCLUDED.embedding_type,
    year = EXCLUDED.year,
    active = EXCLUDED.active,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- ============================================================================
-- STEP 8: Create helper function for document registry queries
-- ============================================================================

-- Function to get active documents (useful for API endpoint)
CREATE OR REPLACE FUNCTION get_active_documents()
RETURNS TABLE (
    slug TEXT,
    title TEXT,
    subtitle TEXT,
    back_link TEXT,
    welcome_message TEXT,
    embedding_type TEXT,
    year TEXT,
    metadata JSONB
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        slug,
        title,
        subtitle,
        back_link,
        welcome_message,
        embedding_type,
        year,
        metadata
    FROM documents
    WHERE active = true
    ORDER BY created_at ASC;
$$;

COMMENT ON FUNCTION get_active_documents IS 'Returns all active documents for the chatbot frontend';

-- ============================================================================
-- Migration Complete!
-- ============================================================================

-- Verify the migration
DO $$
DECLARE
    doc_count INTEGER;
    chunks_count INTEGER;
    chunks_local_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO doc_count FROM documents WHERE active = true;
    SELECT COUNT(*) INTO chunks_count FROM document_chunks;
    SELECT COUNT(*) INTO chunks_local_count FROM document_chunks_local;
    
    RAISE NOTICE '✓ Migration complete!';
    RAISE NOTICE '  - Active documents: %', doc_count;
    RAISE NOTICE '  - Document chunks (OpenAI): %', chunks_count;
    RAISE NOTICE '  - Document chunks (local): %', chunks_local_count;
END $$;

