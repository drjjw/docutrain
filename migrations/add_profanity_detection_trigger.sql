-- Migration: Add profanity detection trigger for chat conversations
-- Created: 2025-01-XX
-- Description: Automatically checks new conversations for profanity and marks them as banned
-- Status: ✅ APPLIED SUCCESSFULLY

-- Ensure pg_net extension is enabled (allows async HTTP requests from database triggers)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop existing trigger if it exists (for idempotent migrations)
DROP TRIGGER IF EXISTS profanity_check_trigger ON chat_conversations;

-- Create function to call the profanity check API endpoint
-- Uses pg_net's http_post function for async HTTP requests
-- This runs AFTER INSERT so it doesn't block the insert operation
CREATE OR REPLACE FUNCTION check_profanity_async()
RETURNS TRIGGER AS $$
DECLARE
  api_url TEXT;
BEGIN
  -- Use environment variable if available, otherwise default to docutrain.io
  -- Note: In Supabase, you can set this via: ALTER DATABASE postgres SET app.api_url = 'https://your-domain.com';
  -- Production URL: https://docutrain.io
  api_url := COALESCE(
    current_setting('app.api_url', true),
    'https://www.docutrain.io'
  );
  
  -- Call the profanity check endpoint asynchronously
  -- Pass conversation_id and question text for checking
  PERFORM net.http_post(
    url := api_url || '/api/profanity-check',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'conversation_id', NEW.id,
      'question', NEW.question
    ),
    timeout_milliseconds := 10000
  );
  
  -- Return NEW to allow the insert to proceed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for chat_conversations table
-- Fires AFTER INSERT (non-blocking - allows insert to complete first)
CREATE TRIGGER profanity_check_trigger
  AFTER INSERT ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION check_profanity_async();

-- Add comments for documentation
COMMENT ON FUNCTION check_profanity_async() IS 
  'Asynchronously calls the profanity check API endpoint to detect inappropriate content in new conversations';

COMMENT ON TRIGGER profanity_check_trigger ON chat_conversations IS 
  'Automatically checks new conversations for profanity after insert and marks as banned if detected';

-- Verification queries (run these to check the migration worked):
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE trigger_name = 'profanity_check_trigger';

-- Monitor webhook calls (to see profanity check API calls):
-- SELECT id, status_code, content::text, created 
-- FROM net._http_response 
-- WHERE url LIKE '%profanity-check%'
-- ORDER BY created DESC 
-- LIMIT 10;

