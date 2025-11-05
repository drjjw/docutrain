-- Migration: Add processing_method column to document_processing_logs
-- Created: 2025-01-XX
-- Description: Track which processing method (edge_function vs vps) was used for each log entry

-- Add processing_method column to track which system processed the document
ALTER TABLE document_processing_logs 
ADD COLUMN IF NOT EXISTS processing_method TEXT DEFAULT 'vps' 
CHECK (processing_method IN ('vps', 'edge_function'));

-- Add index for querying by processing method
CREATE INDEX IF NOT EXISTS idx_processing_logs_processing_method 
ON document_processing_logs(processing_method);

-- Add index for combined queries (user_document_id + processing_method)
CREATE INDEX IF NOT EXISTS idx_processing_logs_user_doc_method 
ON document_processing_logs(user_document_id, processing_method);

-- Add comment for documentation
COMMENT ON COLUMN document_processing_logs.processing_method IS 
'Tracks which processing system was used: vps (default) or edge_function';

