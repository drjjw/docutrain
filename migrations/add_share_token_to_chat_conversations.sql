-- Migration: Add Share Token to Chat Conversations
-- Adds share_token column for generating shareable conversation links
-- Date: 2025-01-XX

-- Add share_token TEXT column (nullable, unique)
ALTER TABLE chat_conversations
ADD COLUMN IF NOT EXISTS share_token TEXT DEFAULT NULL;

-- Add unique constraint on share_token
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_share_token 
ON chat_conversations (share_token) 
WHERE share_token IS NOT NULL;

-- Add index on share_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_chat_conversations_share_token_lookup
ON chat_conversations (share_token);

-- Add comment for documentation
COMMENT ON COLUMN chat_conversations.share_token IS 'Unique token for sharing individual conversations via URL. Generated on conversation creation. NULL for conversations that have not been shared.';

