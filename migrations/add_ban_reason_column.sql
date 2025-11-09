-- Migration: Add ban_reason column to chat_conversations
-- Adds reason tracking for banned conversations (profanity, junk, etc.)
-- Date: 2025-01-XX

-- Step 1: Add ban_reason TEXT column (nullable, only set when banned=true)
ALTER TABLE chat_conversations
ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;

-- Step 2: Set default ban_reason for existing banned rows
-- This ensures existing banned conversations have a reason before adding constraint
UPDATE chat_conversations
SET ban_reason = 'profanity'
WHERE banned = true AND ban_reason IS NULL;

-- Step 3: Add check constraint to ensure ban_reason is only set when banned is true
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chat_conversations_ban_reason_check'
    ) THEN
        ALTER TABLE chat_conversations
        ADD CONSTRAINT chat_conversations_ban_reason_check
        CHECK (
            (banned = true AND ban_reason IS NOT NULL) OR
            (banned = false AND ban_reason IS NULL)
        );
    END IF;
END $$;

-- Step 4: Add index on ban_reason for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_ban_reason
ON chat_conversations (ban_reason)
WHERE ban_reason IS NOT NULL;

-- Step 5: Add comment for documentation
COMMENT ON COLUMN chat_conversations.ban_reason IS 
  'Reason for banning: profanity, junk, spam, etc. Must be set when banned=true, NULL when banned=false';

