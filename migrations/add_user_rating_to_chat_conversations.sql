-- Migration: Add User Rating Column to Chat Conversations
-- Adds user_rating column for storing thumbs up/down feedback on responses
-- Date: 2025-01-XX

-- Add user_rating TEXT column (nullable, with check constraint)
ALTER TABLE chat_conversations
ADD COLUMN IF NOT EXISTS user_rating TEXT DEFAULT NULL;

-- Add check constraint to ensure only valid rating values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chat_conversations_user_rating_check'
    ) THEN
        ALTER TABLE chat_conversations
        ADD CONSTRAINT chat_conversations_user_rating_check
        CHECK (user_rating IN ('thumbs_up', 'thumbs_down', NULL));
    END IF;
END $$;

-- Add index on user_rating for efficient queries (filtering rated conversations)
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_rating
ON chat_conversations (user_rating)
WHERE user_rating IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN chat_conversations.user_rating IS 
  'User rating for this conversation: thumbs_up, thumbs_down, or NULL (no rating). Updated via /api/rate endpoint.';

