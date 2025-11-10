-- Migration: Cleanup Redundant Registered Roles
-- Created: 2025-01-XX
-- Description: Remove redundant registered roles when users are assigned owner_admin for the same owner
--              This complements the user_owner_access cleanup migration

-- =====================================================
-- Step 1: Clean up existing redundant registered roles
-- =====================================================

-- Remove registered roles for users who have owner_admin for the same owner
DELETE FROM user_roles ur
WHERE ur.role = 'registered'
AND EXISTS (
    SELECT 1 
    FROM user_roles ur2
    WHERE ur2.user_id = ur.user_id
    AND ur2.owner_id = ur.owner_id
    AND ur2.role = 'owner_admin'
);

-- =====================================================
-- Step 2: Update cleanup function to also remove redundant registered roles
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_redundant_user_owner_access()
RETURNS TRIGGER AS $$
BEGIN
    -- When a user is assigned an admin role (owner_admin or super_admin),
    -- remove any redundant user_owner_access entries AND redundant registered roles
    
    -- If user is assigned owner_admin for a specific owner
    IF NEW.role IN ('owner_admin') AND NEW.owner_id IS NOT NULL THEN
        -- Remove user_owner_access for that owner
        DELETE FROM user_owner_access
        WHERE user_id = NEW.user_id
        AND owner_id = NEW.owner_id;
        
        -- Remove redundant registered role for the same owner
        DELETE FROM user_roles
        WHERE user_id = NEW.user_id
        AND owner_id = NEW.owner_id
        AND role = 'registered';
    END IF;
    
    -- If user is assigned global super_admin (owner_id IS NULL), remove ALL user_owner_access entries
    -- Super admins have access to all owners automatically
    IF NEW.role = 'super_admin' AND NEW.owner_id IS NULL THEN
        DELETE FROM user_owner_access
        WHERE user_id = NEW.user_id;
        
        -- Remove all registered roles (super_admin has access to everything)
        DELETE FROM user_roles
        WHERE user_id = NEW.user_id
        AND role = 'registered';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_redundant_user_owner_access() IS 
'Automatically removes redundant user_owner_access entries and redundant registered roles when users are assigned admin roles. Admin roles (owner_admin, super_admin) inherit all registered user permissions, making explicit registered roles and user_owner_access entries unnecessary.';

