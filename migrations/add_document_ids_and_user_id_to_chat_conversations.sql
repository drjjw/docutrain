-- Migration: Add Document IDs and User ID to Chat Conversations
-- Adds proper foreign key relationships for document and user tracking
-- Date: 2025-01-XX

-- Add document_ids JSONB column (array of UUIDs) for single and multi-document conversations
ALTER TABLE chat_conversations
ADD COLUMN IF NOT EXISTS document_ids JSONB DEFAULT NULL;

-- Add check constraint to ensure document_ids array contains 1-5 elements when not null
-- Note: UUID format validation is handled at application level or via foreign keys
ALTER TABLE chat_conversations
ADD CONSTRAINT chat_conversations_document_ids_check
CHECK (
    document_ids IS NULL OR
    (
        jsonb_typeof(document_ids) = 'array' AND
        jsonb_array_length(document_ids) >= 1 AND
        jsonb_array_length(document_ids) <= 5
    )
);

-- Add GIN index on document_ids for efficient array queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_document_ids
ON chat_conversations
USING GIN (document_ids);

-- Add user_id UUID column (nullable for anonymous users)
ALTER TABLE chat_conversations
ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT NULL;

-- Add index on user_id for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id
ON chat_conversations (user_id);

-- Add foreign key constraint to auth.users
ALTER TABLE chat_conversations
ADD CONSTRAINT chat_conversations_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE SET NULL;

-- Add comments for documentation
COMMENT ON COLUMN chat_conversations.document_ids IS 'Array of document UUIDs referenced in this conversation (1-5 documents supported). NULL for legacy records.';
COMMENT ON COLUMN chat_conversations.user_id IS 'UUID of authenticated user who created this conversation. NULL for anonymous users or legacy records. References auth.users(id).';

