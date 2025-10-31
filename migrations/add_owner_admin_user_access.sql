-- Migration: Add Owner Admin User Access
-- Created: 2025-10-31
-- Description: Enable owner admins to view and manage users in their owner group

-- =====================================================
-- Helper Function: Get users accessible to owner admin
-- =====================================================

-- Function to get list of user IDs that an owner admin can manage
CREATE OR REPLACE FUNCTION get_owner_admin_accessible_users(p_owner_id UUID)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  RETURN QUERY
  -- Users with roles in this owner group
  SELECT DISTINCT ur.user_id
  FROM user_roles ur
  WHERE ur.owner_id = p_owner_id
  UNION
  -- Users with direct access to this owner group
  SELECT DISTINCT uoa.user_id
  FROM user_owner_access uoa
  WHERE uoa.owner_id = p_owner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_owner_admin_accessible_users IS 'Returns list of user IDs that belong to a specific owner group (via roles or direct access)';

-- =====================================================
-- Helper Function: Check if user is owner admin for any group
-- =====================================================

CREATE OR REPLACE FUNCTION is_any_owner_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id AND role = 'owner_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_any_owner_admin IS 'Check if user has owner_admin role for any owner group';

-- =====================================================
-- Helper Function: Get owner groups for owner admin
-- =====================================================

CREATE OR REPLACE FUNCTION get_owner_admin_groups(p_user_id UUID)
RETURNS TABLE(owner_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT ur.owner_id
  FROM user_roles ur
  WHERE ur.user_id = p_user_id 
    AND ur.role = 'owner_admin'
    AND ur.owner_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_owner_admin_groups IS 'Returns list of owner group IDs that user is an owner_admin for';

-- =====================================================
-- Performance Indexes
-- =====================================================

-- Index for owner admin queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_user_roles_owner_id_role 
  ON user_roles(owner_id, role) 
  WHERE owner_id IS NOT NULL;

-- Index for user access queries
CREATE INDEX IF NOT EXISTS idx_user_owner_access_owner_user 
  ON user_owner_access(owner_id, user_id);

-- =====================================================
-- RLS Policy for auth.users (read-only for owner admins)
-- =====================================================

-- Note: auth.users table RLS policies are managed by Supabase Auth
-- We cannot directly add RLS policies to auth.users
-- Instead, we'll handle access control in the application layer (backend API)
-- The helper functions above will be used by the backend to filter users

-- =====================================================
-- Grant execute permissions on helper functions
-- =====================================================

-- Allow authenticated users to execute these functions
GRANT EXECUTE ON FUNCTION get_owner_admin_accessible_users(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_any_owner_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_owner_admin_groups(UUID) TO authenticated;

-- Also grant to service role for backend operations
GRANT EXECUTE ON FUNCTION get_owner_admin_accessible_users(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION is_any_owner_admin(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_owner_admin_groups(UUID) TO service_role;

