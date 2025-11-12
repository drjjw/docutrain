-- Migration: Cleanup Redundant user_owner_access Entries
-- Created: 2025-01-XX
-- Description: Remove user_owner_access entries for users who have admin roles (owner_admin or super_admin)
--              Admin roles inherit all registered user permissions, so user_owner_access is redundant

-- =====================================================
-- Step 1: Clean up existing redundant entries
-- =====================================================

-- Remove user_owner_access entries where user has owner_admin role for the same owner
DELETE FROM user_owner_access uoa
WHERE EXISTS (
    SELECT 1 
    FROM user_roles ur
    WHERE ur.user_id = uoa.user_id
    AND ur.owner_id = uoa.owner_id
    AND ur.role IN ('owner_admin', 'super_admin')
);

-- Remove user_owner_access entries where user has global super_admin role (super_admin with NULL owner_id)
-- Super admins have access to all owners, so they don't need explicit user_owner_access entries
DELETE FROM user_owner_access uoa
WHERE EXISTS (
    SELECT 1 
    FROM user_roles ur
    WHERE ur.user_id = uoa.user_id
    AND ur.role = 'super_admin'
    AND ur.owner_id IS NULL
);

-- =====================================================
-- Step 2: Create function to automatically clean up redundant access
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_redundant_user_owner_access()
RETURNS TRIGGER AS $$
BEGIN
    -- When a user is assigned an admin role (owner_admin or super_admin),
    -- remove any redundant user_owner_access entries
    
    -- If user is assigned owner_admin for a specific owner, remove user_owner_access for that owner
    IF NEW.role IN ('owner_admin') AND NEW.owner_id IS NOT NULL THEN
        DELETE FROM user_owner_access
        WHERE user_id = NEW.user_id
        AND owner_id = NEW.owner_id;
    END IF;
    
    -- If user is assigned global super_admin (owner_id IS NULL), remove ALL user_owner_access entries
    -- Super admins have access to all owners automatically
    IF NEW.role = 'super_admin' AND NEW.owner_id IS NULL THEN
        DELETE FROM user_owner_access
        WHERE user_id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Step 3: Create trigger to auto-cleanup on role assignment
-- =====================================================

DROP TRIGGER IF EXISTS trigger_cleanup_redundant_access ON user_roles;

CREATE TRIGGER trigger_cleanup_redundant_access
    AFTER INSERT OR UPDATE ON user_roles
    FOR EACH ROW
    WHEN (NEW.role IN ('owner_admin', 'super_admin'))
    EXECUTE FUNCTION cleanup_redundant_user_owner_access();

COMMENT ON FUNCTION cleanup_redundant_user_owner_access() IS 
'Automatically removes redundant user_owner_access entries when users are assigned admin roles. Admin roles (owner_admin, super_admin) inherit all registered user permissions, making explicit user_owner_access entries unnecessary.';

COMMENT ON TRIGGER trigger_cleanup_redundant_access ON user_roles IS 
'Automatically cleans up redundant user_owner_access entries when admin roles are assigned';

-- =====================================================
-- Step 4: Update comments to clarify role hierarchy
-- =====================================================

COMMENT ON TABLE user_roles IS 
'User roles within owner groups. Role hierarchy: registered < owner_admin < super_admin. Admin roles inherit all permissions from registered users, so users with admin roles do not need separate user_owner_access entries.';

COMMENT ON COLUMN user_roles.role IS 
'Role type: registered (basic access), owner_admin (manages owner group, inherits registered permissions), super_admin (system-wide admin, inherits all permissions). When upgraded from registered to owner_admin, the user_owner_access entry is automatically removed as it becomes redundant.';

COMMENT ON TABLE user_owner_access IS 
'Grants registered users access to owner groups. This table is ONLY for users with the registered role. Users with owner_admin or super_admin roles automatically have access and do not need entries here. When a user is upgraded to owner_admin, their user_owner_access entry is automatically removed.';





