-- Create document_processing_logs table for tracking processing pipeline
-- Applied: 2025-10-29
-- Purpose: Track document processing stages with detailed logging

CREATE TABLE IF NOT EXISTS document_processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_document_id UUID NOT NULL REFERENCES user_documents(id) ON DELETE CASCADE,
    document_slug TEXT,
    stage TEXT NOT NULL CHECK (stage IN ('download', 'extract', 'chunk', 'embed', 'store', 'complete', 'error')),
    status TEXT NOT NULL CHECK (status IN ('started', 'progress', 'completed', 'failed')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for efficient querying by user_document_id
CREATE INDEX IF NOT EXISTS idx_processing_logs_user_doc_id ON document_processing_logs(user_document_id);

-- Add index for querying by document_slug
CREATE INDEX IF NOT EXISTS idx_processing_logs_doc_slug ON document_processing_logs(document_slug);

-- Add index for time-based queries
CREATE INDEX IF NOT EXISTS idx_processing_logs_created_at ON document_processing_logs(created_at DESC);

-- Enable RLS
ALTER TABLE document_processing_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view logs for their own documents
CREATE POLICY "Users can view their own document processing logs"
    ON document_processing_logs
    FOR SELECT
    USING (
        user_document_id IN (
            SELECT id FROM user_documents WHERE user_id = auth.uid()
        )
    );

-- Policy: Service role can insert logs
CREATE POLICY "Service role can insert processing logs"
    ON document_processing_logs
    FOR INSERT
    WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE document_processing_logs IS 'Audit trail for document processing pipeline operations';
COMMENT ON COLUMN document_processing_logs.stage IS 'Processing stage: download, extract, chunk, embed, store, complete, error';
COMMENT ON COLUMN document_processing_logs.status IS 'Status of the stage: started, progress, completed, failed';
COMMENT ON COLUMN document_processing_logs.metadata IS 'Additional context like chunk counts, timing, errors';

