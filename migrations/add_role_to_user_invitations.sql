-- Migration: Add Role Column to User Invitations
-- Created: 2025-01-XX
-- Description: Add role column to user_invitations table to support assigning roles during invitation
--              Allows super admins to invite users as owner_admin or registered, with optional "none" owner group

-- =====================================================
-- Step 1: Modify owner_id to allow NULL (for "none" option)
-- =====================================================

-- Drop existing NOT NULL constraint on owner_id
ALTER TABLE user_invitations
ALTER COLUMN owner_id DROP NOT NULL;

-- =====================================================
-- Step 2: Add role column
-- =====================================================

ALTER TABLE user_invitations
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'registered' CHECK (role IN ('registered', 'owner_admin'));

-- =====================================================
-- Step 3: Add constraint to ensure owner_admin requires owner_id
-- =====================================================

ALTER TABLE user_invitations
ADD CONSTRAINT user_invitations_role_owner_check 
CHECK (
  (role = 'owner_admin' AND owner_id IS NOT NULL) OR
  (role = 'registered')
);

-- =====================================================
-- Step 4: Update comments
-- =====================================================

COMMENT ON COLUMN user_invitations.role IS 
'Role to assign to user: registered (default) or owner_admin. owner_admin requires owner_id to be set.';

COMMENT ON COLUMN user_invitations.owner_id IS 
'Owner group ID. Can be NULL for registered users with no owner group (future general DocuTrain access). Required for owner_admin role.';

COMMENT ON TABLE user_invitations IS 
'Tracks invitations sent to users for signup. Invited users skip email verification and are automatically assigned the specified role and owner group.';

