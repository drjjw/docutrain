-- Migration: Add Global SuperAdmin Role
-- Created: 2025-10-22
-- Description: Modify user_roles table to support global super_admin roles not tied to specific owner groups

-- =====================================================
-- Modify user_roles table to allow NULL owner_id for global super_admins
-- =====================================================

-- Drop existing constraint that requires owner_id
ALTER TABLE user_roles
DROP CONSTRAINT IF EXISTS user_roles_owner_id_fkey;

-- Modify owner_id column to allow NULL values
ALTER TABLE user_roles
ALTER COLUMN owner_id DROP NOT NULL;

-- Add back the foreign key constraint but allow NULL
ALTER TABLE user_roles
ADD CONSTRAINT user_roles_owner_id_fkey
FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE;

-- Update the check constraint to allow super_admin without owner_id
ALTER TABLE user_roles
DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE user_roles
ADD CONSTRAINT user_roles_role_check
CHECK (
  role IN ('registered', 'owner_admin', 'super_admin')
  AND (
    (role = 'super_admin' AND owner_id IS NULL) -- Global super admin
    OR (role IN ('registered', 'owner_admin') AND owner_id IS NOT NULL) -- Owner-specific roles
  )
);

-- Update unique constraint to handle NULL owner_id for super_admins
ALTER TABLE user_roles
DROP CONSTRAINT IF EXISTS user_roles_user_id_owner_id_key;

ALTER TABLE user_roles
ADD CONSTRAINT user_roles_user_id_owner_id_role_key
UNIQUE (user_id, owner_id, role);

-- Update comments
COMMENT ON COLUMN user_roles.owner_id IS 'Owner group ID for owner-specific roles. NULL for global super_admin roles';
COMMENT ON CONSTRAINT user_roles_role_check ON user_roles IS 'Super admins are global (owner_id=NULL), other roles require specific owner group';

-- =====================================================
-- Update permission functions to handle global super admins
-- =====================================================

-- Update is_super_admin function to work with global super admins
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_user_owner_access to include global super admin access
CREATE OR REPLACE FUNCTION get_user_owner_access(p_user_id UUID)
RETURNS TABLE(owner_id UUID, role TEXT) AS $$
BEGIN
  -- If user is a global super admin, return access to all owners
  IF EXISTS(SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = 'super_admin' AND owner_id IS NULL) THEN
    RETURN QUERY
    SELECT o.id, 'super_admin'::TEXT
    FROM owners o;
  ELSE
    -- Return owner-specific access
    RETURN QUERY
      -- From direct owner access
      SELECT uoa.owner_id, 'registered'::TEXT
      FROM user_owner_access uoa
      WHERE uoa.user_id = p_user_id
      UNION
      -- From role assignments
      SELECT ur.owner_id, ur.role
      FROM user_roles ur
      WHERE ur.user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Update RLS Policies for global super admins
-- =====================================================

-- Update user_roles policies to allow global super admin management
DROP POLICY IF EXISTS "Users read own roles" ON user_roles;
DROP POLICY IF EXISTS "Owner admins read group roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins read all roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins insert roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins update roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins delete roles" ON user_roles;

-- Users can read their own roles
CREATE POLICY "Users read own roles" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Owner admins can read roles for their owner group
CREATE POLICY "Owner admins read group roles" ON user_roles
  FOR SELECT USING (
    owner_id IN (
      SELECT owner_id FROM user_roles
      WHERE user_id = auth.uid() AND role = 'owner_admin'
    )
  );

-- Global super admins can read all roles
CREATE POLICY "Global super admins read all roles" ON user_roles
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin' AND owner_id IS NULL
    )
  );

-- Owner-specific super admins can read roles for their owner groups
CREATE POLICY "Owner super admins read group roles" ON user_roles
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin' AND owner_id = user_roles.owner_id
    )
  );

-- Global super admins can manage all roles
CREATE POLICY "Global super admins manage all roles" ON user_roles
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin' AND owner_id IS NULL
    )
  );

-- =====================================================
-- Update user_permissions_summary view
-- =====================================================

DROP VIEW IF EXISTS user_permissions_summary;

CREATE OR REPLACE VIEW user_permissions_summary AS
-- Global super admins get access to all owners
SELECT
  sa.user_id,
  'super_admin'::TEXT as role,
  o.id as owner_id,
  o.slug as owner_slug,
  o.name as owner_name
FROM user_roles sa
CROSS JOIN owners o
WHERE sa.role = 'super_admin' AND sa.owner_id IS NULL
UNION
-- Owner-specific roles
SELECT
  ur.user_id,
  ur.role,
  o.id as owner_id,
  o.slug as owner_slug,
  o.name as owner_name
FROM user_roles ur
JOIN owners o ON o.id = ur.owner_id
WHERE ur.owner_id IS NOT NULL
UNION
-- Direct owner access (registered users)
SELECT
  uoa.user_id,
  'registered'::TEXT as role,
  o.id as owner_id,
  o.slug as owner_slug,
  o.name as owner_name
FROM user_owner_access uoa
JOIN owners o ON o.id = uoa.owner_id;

COMMENT ON VIEW user_permissions_summary IS 'Summary of all user permissions across owner groups, including global super admin access';

-- =====================================================
-- Grant SuperAdmin role to Jordan Weinstein
-- =====================================================

-- First, check if he already has any roles and clean them up if needed
DELETE FROM user_roles WHERE user_id = '25b4e5d5-8346-416c-9f08-0bda62026e30';

-- Grant global SuperAdmin role
INSERT INTO user_roles (user_id, role, owner_id)
VALUES ('25b4e5d5-8346-416c-9f08-0bda62026e30', 'super_admin', NULL);
