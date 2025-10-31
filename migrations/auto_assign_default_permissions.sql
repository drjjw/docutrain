-- Migration: Auto-assign default permissions to new users
-- Created: 2025-01-31
-- Description: Automatically grant new users owner_admin role on default owner group when they sign up

-- =====================================================
-- Function: Auto-assign default permissions
-- =====================================================
CREATE OR REPLACE FUNCTION auto_assign_default_permissions()
RETURNS TRIGGER AS $$
DECLARE
  default_owner_id UUID;
BEGIN
  -- Get the default owner group ID
  SELECT id INTO default_owner_id
  FROM owners
  WHERE slug = 'default'
  LIMIT 1;
  
  -- If default owner exists, assign owner_admin role to new user
  IF default_owner_id IS NOT NULL THEN
    -- Insert owner_admin role for the new user
    INSERT INTO user_roles (user_id, owner_id, role)
    VALUES (NEW.user_id, default_owner_id, 'owner_admin')
    ON CONFLICT (user_id, owner_id) DO NOTHING;
    
    RAISE NOTICE 'Auto-assigned owner_admin role to user % on default owner group', NEW.user_id;
  ELSE
    RAISE WARNING 'Default owner group not found - cannot auto-assign permissions';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Trigger: Auto-assign permissions when user profile is created
-- =====================================================
-- This trigger fires when a user_profiles record is inserted
-- (which happens during signup when TOS is accepted)
DROP TRIGGER IF EXISTS trigger_auto_assign_default_permissions ON user_profiles;
CREATE TRIGGER trigger_auto_assign_default_permissions
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_default_permissions();

COMMENT ON FUNCTION auto_assign_default_permissions IS 'Automatically assigns owner_admin role to new users on the default owner group when they sign up';
COMMENT ON TRIGGER trigger_auto_assign_default_permissions ON user_profiles IS 'Fires after user profile creation to auto-assign default permissions';

