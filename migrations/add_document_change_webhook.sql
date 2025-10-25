-- Migration: Add webhook trigger for document changes
-- Created: 2025-10-25
-- Description: Automatically refresh server cache when documents table changes
-- Status: ✅ APPLIED SUCCESSFULLY

-- Enable pg_net extension if not already enabled
-- This extension allows async HTTP requests from database triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop existing triggers if they exist (for idempotent migrations)
DROP TRIGGER IF EXISTS refresh_registry_on_document_change ON documents;
DROP TRIGGER IF EXISTS refresh_registry_on_owner_change ON owners;

-- Create function to call the refresh endpoint
-- Uses pg_net's http_post function for async HTTP requests
CREATE OR REPLACE FUNCTION trigger_refresh_registry()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://bot.ukidney.com/api/refresh-registry',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for documents table (INSERT, UPDATE, DELETE)
-- Fires on ANY column change (title, subtitle, downloads, pmid, metadata, etc.)
CREATE TRIGGER refresh_registry_on_document_change
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_registry();

-- Create trigger for owners table (UPDATE only)
-- Fires when owner defaults change (intro_message, default_cover, etc.)
CREATE TRIGGER refresh_registry_on_owner_change
  AFTER UPDATE ON owners
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_registry();

-- Add comments for documentation
COMMENT ON FUNCTION trigger_refresh_registry() IS 
  'Calls the server refresh endpoint to invalidate document registry cache';

COMMENT ON TRIGGER refresh_registry_on_document_change ON documents IS 
  'Automatically calls server refresh endpoint when documents are inserted, updated, or deleted';

COMMENT ON TRIGGER refresh_registry_on_owner_change ON owners IS 
  'Automatically calls server refresh endpoint when owner defaults are updated';

-- Verification queries (run these to check the migration worked):
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE trigger_name LIKE 'refresh_registry%';

-- Monitor webhook calls:
-- SELECT id, status_code, content::text, created 
-- FROM net._http_response 
-- ORDER BY created DESC 
-- LIMIT 10;

