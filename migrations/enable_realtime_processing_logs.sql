-- Enable realtime for document_processing_logs table
-- This allows the frontend to receive instant updates when quiz generation progresses
-- Applied: 2025-11-09

-- Add document_processing_logs table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE document_processing_logs;

-- Verify it was added (for reference)
-- You can check with: SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

