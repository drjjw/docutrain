-- Migration: Add user authentication support to chat_conversations
-- Description: Adds user_id column to track authenticated users
-- Date: 2025-10-20

-- Step 1: Add user_id column
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Step 2: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id 
ON chat_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_session 
ON chat_conversations(user_id, session_id);

-- Step 3: Add helpful comment
COMMENT ON COLUMN chat_conversations.user_id IS 'References auth.users - NULL for anonymous conversations';

-- Verification queries (run these to verify the migration)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'chat_conversations' AND column_name = 'user_id';
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'chat_conversations' AND indexname LIKE '%user_id%';
