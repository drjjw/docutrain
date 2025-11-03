-- Migration: Add IP Address to Chat Conversations
-- Adds IP address tracking for conversation history (matching Downloads tracking)
-- Date: 2025-01-XX

-- Add ip_address TEXT column (nullable for legacy records)
ALTER TABLE chat_conversations
ADD COLUMN IF NOT EXISTS ip_address TEXT DEFAULT NULL;

-- Add index on ip_address for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_ip_address
ON chat_conversations (ip_address);

-- Add comment for documentation
COMMENT ON COLUMN chat_conversations.ip_address IS 'IP address for conversation tracking. NULL for legacy records or when IP cannot be determined.';

