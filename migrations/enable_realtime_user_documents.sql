-- Enable realtime for user_documents table
-- This allows the frontend to receive instant updates when document status changes

-- Add user_documents table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE user_documents;

-- Verify it was added (for reference)
-- You can check with: SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';


