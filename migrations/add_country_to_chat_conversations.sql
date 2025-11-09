-- Migration: Add Country to Chat Conversations
-- Adds country tracking based on IP address geolocation
-- Date: 2025-01-XX

-- Add country TEXT column (nullable for legacy records or when lookup fails)
ALTER TABLE chat_conversations
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL;

-- Add index on country for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_country
ON chat_conversations (country)
WHERE country IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN chat_conversations.country IS 'Country code (ISO 3166-1 alpha-2) determined from IP address geolocation. NULL for legacy records or when lookup fails.';

