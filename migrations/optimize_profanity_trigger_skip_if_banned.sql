-- Migration: Optimize profanity check trigger to skip if already banned
-- Created: 2025-01-XX
-- Description: Skip async profanity check if conversation is already banned (set synchronously)
-- Status: ✅ READY TO APPLY

-- Update the trigger function to skip if conversation is already banned
-- This prevents redundant API calls when synchronous check has already banned the conversation
CREATE OR REPLACE FUNCTION check_profanity_async()
RETURNS TRIGGER AS $$
DECLARE
  api_url TEXT;
BEGIN
  -- Skip if conversation is already banned (set synchronously before insert)
  -- This prevents redundant API calls
  IF NEW.banned = true THEN
    RETURN NEW;
  END IF;

  -- Use environment variable if available, otherwise default to docutrain.io
  -- Note: In Supabase, you can set this via: ALTER DATABASE postgres SET app.api_url = 'https://your-domain.com';
  -- Production URL: https://docutrain.io
  api_url := COALESCE(
    current_setting('app.api_url', true),
    'https://www.docutrain.io'
  );
  
  -- Call the profanity check endpoint asynchronously
  -- Pass conversation_id and question text for checking
  -- Only called if conversation is NOT already banned
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

-- Add comment explaining the optimization
COMMENT ON FUNCTION check_profanity_async() IS 
  'Asynchronously calls the profanity check API endpoint to detect inappropriate content in new conversations. Skips if conversation is already banned (set synchronously before insert).';

