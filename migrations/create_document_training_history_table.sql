-- Create document_training_history table for tracking training/retraining activities
-- Applied: 2025-01-XX
-- Purpose: Track user training and retraining activities for audit and history

CREATE TABLE IF NOT EXISTS document_training_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    document_slug TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    user_document_id UUID REFERENCES user_documents(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('train', 'retrain_replace', 'retrain_add')),
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
    upload_type TEXT CHECK (upload_type IN ('pdf', 'text')),
    retrain_mode TEXT CHECK (retrain_mode IN ('replace', 'add')),
    file_name TEXT,
    file_size BIGINT,
    chunk_count INTEGER,
    existing_chunk_count INTEGER, -- For retrain_add mode
    processing_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_training_history_document_id ON document_training_history(document_id);
CREATE INDEX IF NOT EXISTS idx_training_history_document_slug ON document_training_history(document_slug);
CREATE INDEX IF NOT EXISTS idx_training_history_user_id ON document_training_history(user_id);
CREATE INDEX IF NOT EXISTS idx_training_history_created_at ON document_training_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_history_user_doc_id ON document_training_history(user_document_id);

-- Enable RLS
ALTER TABLE document_training_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view history for documents they own or have access to
CREATE POLICY "Users can view training history for accessible documents"
    ON document_training_history
    FOR SELECT
    USING (
        -- Users can see their own training activities
        user_id = auth.uid()
        -- Or documents they own
        OR document_id IN (
            SELECT id FROM documents 
            WHERE owner_id IN (
                SELECT id FROM owners WHERE user_id = auth.uid()
            )
            OR uploaded_by_user_id = auth.uid()
            -- Or documents they have access to via owner groups
            OR id IN (
                SELECT d.id FROM documents d
                WHERE d.access_level = 'public'
                OR (d.access_level = 'registered' AND auth.uid() IS NOT NULL)
                OR (d.access_level = 'owner_restricted' AND EXISTS (
                    SELECT 1 FROM user_owner_access uoa
                    JOIN owners o ON o.id = uoa.owner_id
                    WHERE uoa.user_id = auth.uid() AND o.id = d.owner_id
                ))
                OR (d.access_level = 'owner_admin_only' AND EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN owners o ON o.id = ur.owner_id
                    WHERE ur.user_id = auth.uid() 
                    AND ur.role = 'owner_admin' 
                    AND o.id = d.owner_id
                ))
            )
        )
    );

-- Policy: Service role can insert history entries
CREATE POLICY "Service role can insert training history"
    ON document_training_history
    FOR INSERT
    WITH CHECK (true);

-- Policy: Admins can view all training history
CREATE POLICY "Admins can view all training history"
    ON document_training_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'superadmin')
        )
    );

-- Comment on table
COMMENT ON TABLE document_training_history IS 'Audit trail for document training and retraining activities';
COMMENT ON COLUMN document_training_history.action_type IS 'Type of action: train (initial), retrain_replace (replace all chunks), retrain_add (add chunks)';
COMMENT ON COLUMN document_training_history.status IS 'Status: started, completed, failed';
COMMENT ON COLUMN document_training_history.retrain_mode IS 'For retraining: replace (delete all) or add (incremental)';
COMMENT ON COLUMN document_training_history.existing_chunk_count IS 'Number of existing chunks before retrain_add operation';

