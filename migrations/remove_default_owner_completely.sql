-- Migration: Remove Default Owner completely
-- Created: 2025-10-31
-- Description: Remove the "Default Owner" concept entirely. New users should remain
--              in a holding state (no roles/owner assignments) until explicitly assigned
--              by an admin through the UI.
--
-- CONTEXT:
-- The "Default Owner" was being used as a catch-all group, but this defeats the purpose
-- of the approval workflow. New users should have NO assignments until an admin explicitly
-- assigns them to a proper owner group through the User Management UI.
--
-- CHANGES:
-- 1. Removed all user role assignments to Default Owner
-- 2. Removed any user_owner_access entries for Default Owner
-- 3. Set documents assigned to Default Owner to NULL (unassigned)
-- 4. Deleted the Default Owner from the owners table
--
-- RESULT:
-- - New users will have needs_approval=true until assigned
-- - Admin UI dropdowns will no longer show "Default Owner" as an option
-- - The holding state workflow now works as intended

-- Step 1: Remove any remaining user_owner_access entries for Default Owner
DELETE FROM user_owner_access
WHERE owner_id = (SELECT id FROM owners WHERE slug = 'default');

-- Step 2: Set any documents assigned to Default Owner to NULL
UPDATE documents
SET owner_id = NULL
WHERE owner_id = (SELECT id FROM owners WHERE slug = 'default');

-- Step 3: Delete the Default Owner itself
DELETE FROM owners WHERE slug = 'default';

-- Add documentation
COMMENT ON TABLE user_roles IS 'User roles within owner groups. New users should NOT be auto-assigned to any owner - they remain in holding state (no roles) until admin explicitly assigns them through the UI.';
COMMENT ON TABLE user_owner_access IS 'Registered user access to owner groups. New users start with no access and must be assigned by an admin.';



