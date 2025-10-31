-- Migration: Remove auto-assign default permissions
-- Created: 2025-01-31
-- Description: Remove automatic role assignment - admins should explicitly assign roles through the UI

-- Remove the trigger (if it exists)
DROP TRIGGER IF EXISTS trigger_auto_assign_default_permissions ON user_profiles;

-- Remove the function (if it exists)
DROP FUNCTION IF EXISTS auto_assign_default_permissions();

COMMENT ON FUNCTION auto_assign_default_permissions IS 'Removed - admins should explicitly assign roles through the UI';

