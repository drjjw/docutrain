-- Fix: Use current document slug from documents table instead of stale chunk slug
-- Date: 2025-01-27
-- Issue: RPC functions were returning document_slug directly from chunks table,
--        which could be stale if document slug was changed after chunks were created.
--        This caused confusion when chunks appeared to be from wrong document.
--
-- Solution: JOIN with documents table to get current slug instead of using stale chunk slug

-- Fix single-document hybrid function (OpenAI embeddings)
CREATE OR REPLACE FUNCTION public.match_document_chunks_hybrid(
    query_embedding vector, 
    query_text text, 
    doc_id uuid, 
    match_threshold double precision DEFAULT 0.2, 
    match_count integer DEFAULT 5
)
RETURNS TABLE(
    id uuid, 
    document_slug text, 
    content text, 
    chunk_index integer, 
    similarity double precision, 
    page_number integer, 
    metadata jsonb
)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH matching_chunks AS (
        SELECT
            dc.id,
            d.slug as document_slug,  -- Use current slug from documents table, not stale chunk slug
            dc.content,
            dc.chunk_index,
            1 - (dc.embedding <=> query_embedding) as similarity,
            (dc.metadata->>'page_number')::int as page_number,
            dc.metadata,
            CASE 
                WHEN to_tsvector('english', dc.content) @@ plainto_tsquery('english', query_text) 
                THEN 0.1 
                ELSE 0 
            END as text_boost
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id  -- Join to get current document slug
        WHERE dc.document_id = doc_id
            AND (
                1 - (dc.embedding <=> query_embedding) > match_threshold
                OR to_tsvector('english', dc.content) @@ plainto_tsquery('english', query_text)
            )
    )
    SELECT
        matching_chunks.id,
        matching_chunks.document_slug,
        matching_chunks.content,
        matching_chunks.chunk_index,
        matching_chunks.similarity,
        matching_chunks.page_number,
        matching_chunks.metadata
    FROM matching_chunks
    ORDER BY (matching_chunks.similarity + matching_chunks.text_boost) DESC, matching_chunks.chunk_index
    LIMIT match_count;
END;
$function$;

-- Fix single-document hybrid function (local embeddings)
CREATE OR REPLACE FUNCTION public.match_document_chunks_local_hybrid(
    query_embedding vector(384), 
    query_text text, 
    doc_id uuid, 
    match_threshold double precision DEFAULT 0.05, 
    match_count integer DEFAULT 5
)
RETURNS TABLE(
    id uuid, 
    document_slug text, 
    content text, 
    chunk_index integer, 
    similarity double precision, 
    page_number integer, 
    metadata jsonb
)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH matching_chunks AS (
        SELECT
            dc.id,
            d.slug as document_slug,  -- Use current slug from documents table
            dc.content,
            dc.chunk_index,
            1 - (dc.embedding <=> query_embedding) as similarity,
            (dc.metadata->>'page_number')::int as page_number,
            dc.metadata,
            CASE 
                WHEN to_tsvector('english', dc.content) @@ plainto_tsquery('english', query_text) 
                THEN 0.1 
                ELSE 0 
            END as text_boost
        FROM document_chunks_local dc
        JOIN documents d ON dc.document_id = d.id  -- Join to get current document slug
        WHERE dc.document_id = doc_id
            AND (
                1 - (dc.embedding <=> query_embedding) > match_threshold
                OR to_tsvector('english', dc.content) @@ plainto_tsquery('english', query_text)
            )
    )
    SELECT
        matching_chunks.id,
        matching_chunks.document_slug,
        matching_chunks.content,
        matching_chunks.chunk_index,
        matching_chunks.similarity,
        matching_chunks.page_number,
        matching_chunks.metadata
    FROM matching_chunks
    ORDER BY (matching_chunks.similarity + matching_chunks.text_boost) DESC, matching_chunks.chunk_index
    LIMIT match_count;
END;
$function$;

-- Fix multi-document hybrid function (OpenAI embeddings)
CREATE OR REPLACE FUNCTION public.match_document_chunks_hybrid_multi(
    query_embedding vector, 
    query_text text, 
    doc_ids uuid[], 
    match_threshold double precision DEFAULT 0.2, 
    match_count_per_doc integer DEFAULT 5
)
RETURNS TABLE(
    id uuid, 
    document_slug text, 
    content text, 
    chunk_index integer, 
    similarity double precision, 
    page_number integer, 
    metadata jsonb, 
    document_name text
)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH matching_chunks AS (
        SELECT
            dc.id,
            d.slug as document_slug,  -- Use current slug from documents table
            dc.content,
            dc.chunk_index,
            1 - (dc.embedding <=> query_embedding) as similarity,
            (dc.metadata->>'page_number')::int as page_number,
            dc.metadata,
            dc.document_name,
            dc.document_id,
            CASE 
                WHEN to_tsvector('english', dc.content) @@ plainto_tsquery('english', query_text) 
                THEN 0.1 
                ELSE 0 
            END as text_boost,
            ROW_NUMBER() OVER (
                PARTITION BY dc.document_id 
                ORDER BY (1 - (dc.embedding <=> query_embedding) + 
                    CASE 
                        WHEN to_tsvector('english', dc.content) @@ plainto_tsquery('english', query_text) 
                        THEN 0.1 
                        ELSE 0 
                    END) DESC
            ) AS rank_in_doc
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id  -- Join to get current document slug
        WHERE dc.document_id = ANY(doc_ids)
            AND (
                1 - (dc.embedding <=> query_embedding) > match_threshold
                OR to_tsvector('english', dc.content) @@ plainto_tsquery('english', query_text)
            )
    )
    SELECT
        matching_chunks.id,
        matching_chunks.document_slug,
        matching_chunks.content,
        matching_chunks.chunk_index,
        matching_chunks.similarity,
        matching_chunks.page_number,
        matching_chunks.metadata,
        matching_chunks.document_name
    FROM matching_chunks
    WHERE rank_in_doc <= match_count_per_doc
    ORDER BY (matching_chunks.similarity + matching_chunks.text_boost) DESC;
END;
$function$;

-- Fix multi-document hybrid function (local embeddings)
CREATE OR REPLACE FUNCTION public.match_document_chunks_local_hybrid_multi(
    query_embedding vector(384), 
    query_text text, 
    doc_ids uuid[], 
    match_threshold double precision DEFAULT 0.05, 
    match_count_per_doc integer DEFAULT 5
)
RETURNS TABLE(
    id uuid, 
    document_slug text, 
    content text, 
    chunk_index integer, 
    similarity double precision, 
    page_number integer, 
    metadata jsonb, 
    document_name text
)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH matching_chunks AS (
        SELECT
            dc.id,
            d.slug as document_slug,  -- Use current slug from documents table
            dc.content,
            dc.chunk_index,
            1 - (dc.embedding <=> query_embedding) as similarity,
            (dc.metadata->>'page_number')::int as page_number,
            dc.metadata,
            dc.document_name,
            dc.document_id,
            CASE 
                WHEN to_tsvector('english', dc.content) @@ plainto_tsquery('english', query_text) 
                THEN 0.1 
                ELSE 0 
            END as text_boost,
            ROW_NUMBER() OVER (
                PARTITION BY dc.document_id 
                ORDER BY (1 - (dc.embedding <=> query_embedding) + 
                    CASE 
                        WHEN to_tsvector('english', dc.content) @@ plainto_tsquery('english', query_text) 
                        THEN 0.1 
                        ELSE 0 
                    END) DESC
            ) AS rank_in_doc
        FROM document_chunks_local dc
        JOIN documents d ON dc.document_id = d.id  -- Join to get current document slug
        WHERE dc.document_id = ANY(doc_ids)
            AND (
                1 - (dc.embedding <=> query_embedding) > match_threshold
                OR to_tsvector('english', dc.content) @@ plainto_tsquery('english', query_text)
            )
    )
    SELECT
        matching_chunks.id,
        matching_chunks.document_slug,
        matching_chunks.content,
        matching_chunks.chunk_index,
        matching_chunks.similarity,
        matching_chunks.page_number,
        matching_chunks.metadata,
        matching_chunks.document_name
    FROM matching_chunks
    WHERE rank_in_doc <= match_count_per_doc
    ORDER BY (matching_chunks.similarity + matching_chunks.text_boost) DESC;
END;
$function$;

COMMENT ON FUNCTION match_document_chunks_hybrid IS 'Hybrid search (vector + full-text) for single document with OpenAI embeddings. Returns current document slug from documents table.';
COMMENT ON FUNCTION match_document_chunks_local_hybrid IS 'Hybrid search (vector + full-text) for single document with local embeddings. Returns current document slug from documents table.';
COMMENT ON FUNCTION match_document_chunks_hybrid_multi IS 'Hybrid search (vector + full-text) for multiple documents with OpenAI embeddings. Returns current document slug from documents table.';
COMMENT ON FUNCTION match_document_chunks_local_hybrid_multi IS 'Hybrid search (vector + full-text) for multiple documents with local embeddings. Returns current document slug from documents table.';

