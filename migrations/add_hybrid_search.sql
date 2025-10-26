-- Add Hybrid Search (Vector + Full-Text) to Document Chunks
-- This migration adds full-text search capabilities alongside vector search
-- to improve retrieval of exact keyword matches (e.g., ingredient names)

-- ============================================================================
-- STEP 1: Add tsvector columns for full-text search
-- ============================================================================

-- Add full-text search column to document_chunks (OpenAI embeddings)
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS content_tsv tsvector 
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Add full-text search column to document_chunks_local (local embeddings)
ALTER TABLE document_chunks_local 
ADD COLUMN IF NOT EXISTS content_tsv tsvector 
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- ============================================================================
-- STEP 2: Create GIN indexes for fast full-text search
-- ============================================================================

-- Create GIN index for OpenAI embeddings table
CREATE INDEX IF NOT EXISTS document_chunks_content_tsv_idx 
ON document_chunks USING GIN (content_tsv);

-- Create GIN index for local embeddings table
CREATE INDEX IF NOT EXISTS document_chunks_local_content_tsv_idx 
ON document_chunks_local USING GIN (content_tsv);

-- ============================================================================
-- STEP 3: Create hybrid search function for single document (OpenAI)
-- ============================================================================

CREATE OR REPLACE FUNCTION match_document_chunks_hybrid(
    query_embedding vector(1536),
    query_text TEXT,
    doc_slug TEXT,
    match_threshold FLOAT DEFAULT 0.2,  -- Lower threshold since we have text search backup
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    document_slug TEXT,
    document_name TEXT,
    chunk_index INTEGER,
    content TEXT,
    metadata JSONB,
    similarity FLOAT,
    text_rank REAL,
    combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_slug,
        dc.document_name,
        dc.chunk_index,
        dc.content,
        dc.metadata,
        (1 - (dc.embedding <=> query_embedding)) AS similarity,
        ts_rank(dc.content_tsv, plainto_tsquery('english', query_text)) AS text_rank,
        -- Weighted combination: 70% vector similarity, 30% text relevance
        (0.7 * (1 - (dc.embedding <=> query_embedding)) + 
         0.3 * ts_rank(dc.content_tsv, plainto_tsquery('english', query_text))) AS combined_score
    FROM document_chunks dc
    WHERE dc.document_slug = doc_slug
        AND (
            -- Either passes vector similarity threshold
            (1 - (dc.embedding <=> query_embedding)) > match_threshold
            OR 
            -- Or has text match (catches exact keyword matches)
            dc.content_tsv @@ plainto_tsquery('english', query_text)
        )
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- STEP 4: Create hybrid search function for multiple documents (OpenAI)
-- ============================================================================

CREATE OR REPLACE FUNCTION match_document_chunks_hybrid_multi(
    query_embedding vector(1536),
    query_text TEXT,
    doc_slugs TEXT[],
    match_threshold FLOAT DEFAULT 0.2,
    match_count_per_doc INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    document_slug TEXT,
    document_name TEXT,
    chunk_index INTEGER,
    content TEXT,
    metadata JSONB,
    similarity FLOAT,
    text_rank REAL,
    combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM (
        SELECT
            dc.id,
            dc.document_slug,
            dc.document_name,
            dc.chunk_index,
            dc.content,
            dc.metadata,
            (1 - (dc.embedding <=> query_embedding)) AS similarity,
            ts_rank(dc.content_tsv, plainto_tsquery('english', query_text)) AS text_rank,
            (0.7 * (1 - (dc.embedding <=> query_embedding)) + 
             0.3 * ts_rank(dc.content_tsv, plainto_tsquery('english', query_text))) AS combined_score,
            ROW_NUMBER() OVER (
                PARTITION BY dc.document_slug 
                ORDER BY (0.7 * (1 - (dc.embedding <=> query_embedding)) + 
                         0.3 * ts_rank(dc.content_tsv, plainto_tsquery('english', query_text))) DESC
            ) as rn
        FROM document_chunks dc
        WHERE dc.document_slug = ANY(doc_slugs)
            AND (
                (1 - (dc.embedding <=> query_embedding)) > match_threshold
                OR 
                dc.content_tsv @@ plainto_tsquery('english', query_text)
            )
    ) subquery
    WHERE rn <= match_count_per_doc
    ORDER BY combined_score DESC;
END;
$$;

-- ============================================================================
-- STEP 5: Create hybrid search function for single document (Local embeddings)
-- ============================================================================

CREATE OR REPLACE FUNCTION match_document_chunks_local_hybrid(
    query_embedding vector(384),
    query_text TEXT,
    doc_slug TEXT,
    match_threshold FLOAT DEFAULT 0.05,  -- Lower threshold for local embeddings
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    document_slug TEXT,
    document_name TEXT,
    chunk_index INTEGER,
    content TEXT,
    metadata JSONB,
    similarity FLOAT,
    text_rank REAL,
    combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_slug,
        dc.document_name,
        dc.chunk_index,
        dc.content,
        dc.metadata,
        (1 - (dc.embedding <=> query_embedding)) AS similarity,
        ts_rank(dc.content_tsv, plainto_tsquery('english', query_text)) AS text_rank,
        -- Weighted combination: 70% vector similarity, 30% text relevance
        (0.7 * (1 - (dc.embedding <=> query_embedding)) + 
         0.3 * ts_rank(dc.content_tsv, plainto_tsquery('english', query_text))) AS combined_score
    FROM document_chunks_local dc
    WHERE dc.document_slug = doc_slug
        AND (
            (1 - (dc.embedding <=> query_embedding)) > match_threshold
            OR 
            dc.content_tsv @@ plainto_tsquery('english', query_text)
        )
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- STEP 6: Create hybrid search function for multiple documents (Local embeddings)
-- ============================================================================

CREATE OR REPLACE FUNCTION match_document_chunks_local_hybrid_multi(
    query_embedding vector(384),
    query_text TEXT,
    doc_slugs TEXT[],
    match_threshold FLOAT DEFAULT 0.05,
    match_count_per_doc INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    document_slug TEXT,
    document_name TEXT,
    chunk_index INTEGER,
    content TEXT,
    metadata JSONB,
    similarity FLOAT,
    text_rank REAL,
    combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM (
        SELECT
            dc.id,
            dc.document_slug,
            dc.document_name,
            dc.chunk_index,
            dc.content,
            dc.metadata,
            (1 - (dc.embedding <=> query_embedding)) AS similarity,
            ts_rank(dc.content_tsv, plainto_tsquery('english', query_text)) AS text_rank,
            (0.7 * (1 - (dc.embedding <=> query_embedding)) + 
             0.3 * ts_rank(dc.content_tsv, plainto_tsquery('english', query_text))) AS combined_score,
            ROW_NUMBER() OVER (
                PARTITION BY dc.document_slug 
                ORDER BY (0.7 * (1 - (dc.embedding <=> query_embedding)) + 
                         0.3 * ts_rank(dc.content_tsv, plainto_tsquery('english', query_text))) DESC
            ) as rn
        FROM document_chunks_local dc
        WHERE dc.document_slug = ANY(doc_slugs)
            AND (
                (1 - (dc.embedding <=> query_embedding)) > match_threshold
                OR 
                dc.content_tsv @@ plainto_tsquery('english', query_text)
            )
    ) subquery
    WHERE rn <= match_count_per_doc
    ORDER BY combined_score DESC;
END;
$$;

-- ============================================================================
-- STEP 7: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN document_chunks.content_tsv IS 'Full-text search vector for hybrid search (vector + text)';
COMMENT ON COLUMN document_chunks_local.content_tsv IS 'Full-text search vector for hybrid search (vector + text)';

COMMENT ON FUNCTION match_document_chunks_hybrid IS 'Hybrid search (vector + full-text) for single document with OpenAI embeddings';
COMMENT ON FUNCTION match_document_chunks_hybrid_multi IS 'Hybrid search (vector + full-text) for multiple documents with OpenAI embeddings';
COMMENT ON FUNCTION match_document_chunks_local_hybrid IS 'Hybrid search (vector + full-text) for single document with local embeddings';
COMMENT ON FUNCTION match_document_chunks_local_hybrid_multi IS 'Hybrid search (vector + full-text) for multiple documents with local embeddings';



