-- Migration: Update chunk limit functions to support document-level overrides
-- Date: 2025-10-21
-- Description: Updates get_document_chunk_limit and get_multi_document_chunk_limit to check for document-level chunk_limit_override

-- Update get_document_chunk_limit function to support document-level override
CREATE OR REPLACE FUNCTION get_document_chunk_limit(doc_slug TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    chunk_limit INTEGER;
BEGIN
    SELECT
        COALESCE(d.chunk_limit_override, o.default_chunk_limit) INTO chunk_limit
    FROM documents d
    JOIN owners o ON d.owner_id = o.id
    WHERE d.slug = doc_slug AND d.active = true;

    -- Return default if not found
    RETURN COALESCE(chunk_limit, 50);
END;
$$;

COMMENT ON FUNCTION get_document_chunk_limit IS 'Get the configured chunk limit for a document based on document-level override or owner default';

-- Update get_multi_document_chunk_limit function to handle document-level overrides
CREATE OR REPLACE FUNCTION get_multi_document_chunk_limit(doc_slugs TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    chunk_limit INTEGER;
    owner_count INTEGER;
    override_count INTEGER;
BEGIN
    -- Check if all documents have the same effective chunk limit (considering overrides)
    SELECT
        COUNT(DISTINCT COALESCE(d.chunk_limit_override, o.default_chunk_limit)),
        COUNT(DISTINCT d.owner_id)
    INTO override_count, owner_count
    FROM documents d
    JOIN owners o ON d.owner_id = o.id
    WHERE d.slug = ANY(doc_slugs) AND d.active = true;

    -- If all documents have the same effective chunk limit, return it
    -- Otherwise, return default (50)
    IF override_count = 1 THEN
        SELECT COALESCE(d.chunk_limit_override, o.default_chunk_limit) INTO chunk_limit
        FROM documents d
        JOIN owners o ON d.owner_id = o.id
        WHERE d.slug = ANY(doc_slugs) AND d.active = true
        LIMIT 1;
        RETURN COALESCE(chunk_limit, 50);
    ELSE
        RETURN 50;
    END IF;
END;
$$;

COMMENT ON FUNCTION get_multi_document_chunk_limit IS 'Get the chunk limit for multi-document queries (uses document override or owner limit if all docs have same effective limit, otherwise default)';

-- Add document-level forced_grok_model column
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS forced_grok_model TEXT
CHECK (forced_grok_model IS NULL OR forced_grok_model IN ('grok', 'grok-reasoning'));

COMMENT ON COLUMN documents.forced_grok_model IS 'Document-level model override. Takes precedence over owner-level override. Values: grok, grok-reasoning, or NULL for no override.';

-- Replace documents_with_owner view with secure function to fix SECURITY DEFINER lint issue
-- The view was flagged by Supabase linter as a security risk due to accessing RLS tables
DROP VIEW IF EXISTS documents_with_owner;

CREATE OR REPLACE FUNCTION get_documents_with_owner()
RETURNS TABLE (
    id uuid,
    slug text,
    title text,
    subtitle text,
    back_link text,
    welcome_message text,
    pdf_filename text,
    pdf_subdirectory text,
    embedding_type text,
    year text,
    active boolean,
    document_metadata jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    category text,
    owner text,
    owner_id uuid,
    cover text,
    intro_message text,
    downloads jsonb,
    chunk_limit_override integer,
    document_forced_grok_model text,
    owner_id_ref uuid,
    owner_slug text,
    owner_name text,
    default_chunk_limit integer,
    owner_forced_grok_model text,
    owner_metadata jsonb
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
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
        d.category,
        d.owner,
        d.owner_id,
        d.cover,
        d.intro_message,
        d.downloads,
        d.chunk_limit_override,
        d.forced_grok_model as document_forced_grok_model,
        o.id as owner_id_ref,
        o.slug as owner_slug,
        o.name as owner_name,
        o.default_chunk_limit,
        o.forced_grok_model as owner_forced_grok_model,
        o.metadata as owner_metadata
    FROM documents d
    LEFT JOIN owners o ON d.owner_id = o.id;
$$;

COMMENT ON FUNCTION get_documents_with_owner() IS 'Secure function returning documents with their owner information';

-- Grant execute permissions on the function
GRANT EXECUTE ON FUNCTION get_documents_with_owner() TO anon;
GRANT EXECUTE ON FUNCTION get_documents_with_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION get_documents_with_owner() TO service_role;
