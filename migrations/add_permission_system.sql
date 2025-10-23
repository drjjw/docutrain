-- Migration: Add Permission System
-- Created: 2025-10-22
-- Description: Create user roles, owner access, and permission checking functions

-- =====================================================
-- Table: user_roles
-- Purpose: Define user roles within owner groups
-- =====================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('registered', 'owner_admin', 'super_admin')),
  owner_id UUID REFERENCES owners(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, owner_id)
);

COMMENT ON TABLE user_roles IS 'User roles within owner groups (registered, owner_admin, super_admin)';
COMMENT ON COLUMN user_roles.role IS 'registered: basic access, owner_admin: manage owner group, super_admin: system-wide admin';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_owner_id ON user_roles(owner_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- =====================================================
-- Table: user_owner_access
-- Purpose: Grant registered users access to owner groups
-- =====================================================
CREATE TABLE IF NOT EXISTS user_owner_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES owners(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, owner_id)
);

COMMENT ON TABLE user_owner_access IS 'Registered user access to owner groups';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_owner_access_user_id ON user_owner_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_owner_access_owner_id ON user_owner_access(owner_id);

-- =====================================================
-- Enable RLS on new tables
-- =====================================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_owner_access ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies: user_roles
-- =====================================================

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

-- Super admins can read all roles
CREATE POLICY "Super admins read all roles" ON user_roles
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Only super admins can insert roles
CREATE POLICY "Super admins insert roles" ON user_roles
  FOR INSERT WITH CHECK (
    EXISTS(
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Only super admins can update roles
CREATE POLICY "Super admins update roles" ON user_roles
  FOR UPDATE USING (
    EXISTS(
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Only super admins can delete roles
CREATE POLICY "Super admins delete roles" ON user_roles
  FOR DELETE USING (
    EXISTS(
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- =====================================================
-- RLS Policies: user_owner_access
-- =====================================================

-- Users can read their own access grants
CREATE POLICY "Users read own access" ON user_owner_access
  FOR SELECT USING (user_id = auth.uid());

-- Owner admins can read access for their owner group
CREATE POLICY "Owner admins read group access" ON user_owner_access
  FOR SELECT USING (
    owner_id IN (
      SELECT owner_id FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'owner_admin'
    )
  );

-- Super admins can read all access grants
CREATE POLICY "Super admins read all access" ON user_owner_access
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Owner admins and super admins can grant access
CREATE POLICY "Admins grant access" ON user_owner_access
  FOR INSERT WITH CHECK (
    -- Super admin can grant any access
    EXISTS(
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Owner admin can grant access to their owner
    owner_id IN (
      SELECT owner_id FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'owner_admin'
    )
  );

-- Owner admins and super admins can revoke access
CREATE POLICY "Admins revoke access" ON user_owner_access
  FOR DELETE USING (
    -- Super admin can revoke any access
    EXISTS(
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Owner admin can revoke access from their owner
    owner_id IN (
      SELECT owner_id FROM user_roles
      WHERE user_id = auth.uid() AND role = 'owner_admin'
    )
  );

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is owner admin for specific owner
CREATE OR REPLACE FUNCTION is_owner_admin(p_user_id UUID, p_owner_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id 
    AND owner_id = p_owner_id 
    AND role = 'owner_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's accessible owner IDs
CREATE OR REPLACE FUNCTION get_user_owner_access(p_user_id UUID)
RETURNS TABLE(owner_id UUID, role TEXT) AS $$
BEGIN
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated_at trigger for user_roles
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

