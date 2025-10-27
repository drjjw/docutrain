-- Migration: Rewrite Document Permissions System
-- Created: 2025-01-27
-- Description: Replace is_public/requires_auth booleans with access_level enum for clearer permission model

-- =====================================================
-- Step 1: Create new enum type for access levels
-- =====================================================
DO $$ BEGIN
    CREATE TYPE document_access_level AS ENUM (
        'public',
        'passcode',
        'registered',
        'owner_restricted',
        'owner_admin_only'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMENT ON TYPE document_access_level IS 'Document access permission levels: public (no login), passcode (URL passcode), registered (any logged-in user), owner_restricted (owner group members), owner_admin_only (owner admins only)';

-- =====================================================
-- Step 2: Add new columns to documents table
-- =====================================================
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS access_level document_access_level DEFAULT 'public',
ADD COLUMN IF NOT EXISTS passcode TEXT;

COMMENT ON COLUMN documents.access_level IS 'Access permission level for this document';
COMMENT ON COLUMN documents.passcode IS 'Optional passcode required to access document (used when access_level=passcode)';

-- =====================================================
-- Step 3: Migrate existing data
-- =====================================================
-- Migrate based on current is_public and requires_auth values
UPDATE documents 
SET access_level = CASE
    -- Public documents without auth requirement → public
    WHEN is_public = true AND requires_auth = false THEN 'public'::document_access_level
    -- Public documents with auth requirement → registered (any logged-in user)
    WHEN is_public = true AND requires_auth = true THEN 'registered'::document_access_level
    -- Private documents → owner_restricted (best guess, requires owner group membership)
    WHEN is_public = false THEN 'owner_restricted'::document_access_level
    -- Default fallback
    ELSE 'public'::document_access_level
END
WHERE access_level IS NULL OR access_level = 'public';

-- =====================================================
-- Step 4: Drop old RLS policies BEFORE dropping columns
-- =====================================================

-- Drop all existing document SELECT policies that depend on old columns
DROP POLICY IF EXISTS "Public documents readable by all" ON documents;
DROP POLICY IF EXISTS "Public auth-required docs readable by authenticated" ON documents;
DROP POLICY IF EXISTS "Private documents require owner access" ON documents;
DROP POLICY IF EXISTS "Private and restricted documents require owner access" ON documents;
DROP POLICY IF EXISTS "Allow anonymous read active documents" ON documents;

-- Drop existing modification policies if they exist
DROP POLICY IF EXISTS "Allow authenticated insert documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated update documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated delete documents" ON documents;

-- =====================================================
-- Step 5: Drop old columns (after policies are dropped)
-- =====================================================
ALTER TABLE documents 
DROP COLUMN IF EXISTS is_public,
DROP COLUMN IF EXISTS requires_auth;

-- =====================================================
-- Step 6: Rewrite permission check function
-- =====================================================
CREATE OR REPLACE FUNCTION user_has_document_access(
  p_user_id UUID,
  p_document_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  doc_owner_id UUID;
  doc_access_level document_access_level;
  is_super_admin BOOLEAN;
  is_owner_member BOOLEAN;
  is_owner_admin BOOLEAN;
BEGIN
  -- Get document info
  SELECT owner_id, access_level 
  INTO doc_owner_id, doc_access_level
  FROM documents 
  WHERE id = p_document_id;
  
  -- Document not found
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- PUBLIC: Anyone can access
  IF doc_access_level = 'public' THEN
    RETURN true;
  END IF;
  
  -- PASSCODE: For now, treat as public (passcode validation not yet implemented)
  -- TODO: Add passcode validation when feature is built
  IF doc_access_level = 'passcode' THEN
    RETURN true;
  END IF;
  
  -- REGISTERED: Any logged-in user can access
  IF doc_access_level = 'registered' THEN
    RETURN p_user_id IS NOT NULL;
  END IF;
  
  -- For owner-restricted levels, user must be logged in
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user is super admin (can access everything)
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id 
    AND role = 'super_admin'
  ) INTO is_super_admin;
  
  IF is_super_admin THEN
    RETURN true;
  END IF;
  
  -- Document has no owner but requires owner access → deny
  IF doc_owner_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- OWNER_RESTRICTED: Check if user is member of owner group
  IF doc_access_level = 'owner_restricted' THEN
    SELECT EXISTS(
      -- Check user_owner_access table (regular members)
      SELECT 1 FROM user_owner_access 
      WHERE user_id = p_user_id AND owner_id = doc_owner_id
      UNION
      -- Check user_roles table (owner admins and registered users)
      SELECT 1 FROM user_roles
      WHERE user_id = p_user_id 
      AND owner_id = doc_owner_id 
      AND role IN ('owner_admin', 'registered')
    ) INTO is_owner_member;
    
    RETURN is_owner_member;
  END IF;
  
  -- OWNER_ADMIN_ONLY: Check if user is owner admin
  IF doc_access_level = 'owner_admin_only' THEN
    SELECT EXISTS(
      SELECT 1 FROM user_roles
      WHERE user_id = p_user_id 
      AND owner_id = doc_owner_id 
      AND role = 'owner_admin'
    ) INTO is_owner_admin;
    
    RETURN is_owner_admin;
  END IF;
  
  -- Default: deny access
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION user_has_document_access IS 'Check if user has permission to access a document based on access_level and owner group membership';

-- =====================================================
-- Step 7: Update convenience function (by slug)
-- =====================================================
CREATE OR REPLACE FUNCTION user_has_document_access_by_slug(
  p_user_id UUID,
  p_document_slug TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  doc_id UUID;
BEGIN
  SELECT id INTO doc_id FROM documents WHERE slug = p_document_slug;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  RETURN user_has_document_access(p_user_id, doc_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Step 8: Create new RLS policies
-- =====================================================

-- Policy 1: Public and passcode documents (no auth required)
CREATE POLICY "Public and passcode documents readable by all" ON documents
  FOR SELECT 
  USING (
    active = true 
    AND access_level IN ('public', 'passcode')
  );

-- Policy 2: Registered documents (any authenticated user)
CREATE POLICY "Registered documents readable by authenticated users" ON documents
  FOR SELECT TO authenticated
  USING (
    active = true 
    AND access_level = 'registered'
  );

-- Policy 3: Owner-restricted documents (owner group members)
CREATE POLICY "Owner-restricted documents require owner membership" ON documents
  FOR SELECT TO authenticated
  USING (
    active = true 
    AND access_level = 'owner_restricted'
    AND user_has_document_access(auth.uid(), id)
  );

-- Policy 4: Owner-admin-only documents (owner admins only)
CREATE POLICY "Owner-admin-only documents require owner admin role" ON documents
  FOR SELECT TO authenticated
  USING (
    active = true 
    AND access_level = 'owner_admin_only'
    AND user_has_document_access(auth.uid(), id)
  );

-- =====================================================
-- Step 9: Create policies for document modifications
-- =====================================================

-- Only owner admins and super admins can INSERT documents
CREATE POLICY "Owner admins can insert documents" ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Must be super admin OR owner admin of the document's owner group
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND (
        role = 'super_admin'
        OR (role = 'owner_admin' AND owner_id = documents.owner_id)
      )
    )
  );

-- Only owner admins and super admins can UPDATE documents
CREATE POLICY "Owner admins can update documents" ON documents
  FOR UPDATE TO authenticated
  USING (
    -- Must be super admin OR owner admin of the document's owner group
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND (
        role = 'super_admin'
        OR (role = 'owner_admin' AND owner_id = documents.owner_id)
      )
    )
  )
  WITH CHECK (
    -- Same check for the updated row
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND (
        role = 'super_admin'
        OR (role = 'owner_admin' AND owner_id = documents.owner_id)
      )
    )
  );

-- Only owner admins and super admins can DELETE documents
CREATE POLICY "Owner admins can delete documents" ON documents
  FOR DELETE TO authenticated
  USING (
    -- Must be super admin OR owner admin of the document's owner group
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND (
        role = 'super_admin'
        OR (role = 'owner_admin' AND owner_id = documents.owner_id)
      )
    )
  );

-- Keep service role full access policy
-- (This should already exist, but ensure it's present)
DROP POLICY IF EXISTS "Allow service role full access on documents" ON documents;
CREATE POLICY "Allow service role full access on documents" ON documents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Step 10: Update helper view for permissions summary
-- =====================================================
DROP VIEW IF EXISTS user_permissions_summary;

CREATE OR REPLACE VIEW user_permissions_summary AS
-- Super admins (owner_id is NULL)
SELECT 
  ur.user_id,
  ur.role,
  ur.owner_id,
  NULL::text as owner_slug,
  NULL::text as owner_name
FROM user_roles ur
WHERE ur.role = 'super_admin' AND ur.owner_id IS NULL
UNION
-- Owner admins and registered users (have owner_id)
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
-- Regular members from user_owner_access
SELECT 
  uoa.user_id,
  'registered'::TEXT as role,
  o.id as owner_id,
  o.slug as owner_slug,
  o.name as owner_name
FROM user_owner_access uoa
JOIN owners o ON o.id = uoa.owner_id;

COMMENT ON VIEW user_permissions_summary IS 'Summary of all user permissions across owner groups, including super_admins';

-- =====================================================
-- Migration Complete
-- =====================================================
-- Summary:
-- ✓ Created document_access_level enum with 5 levels
-- ✓ Added access_level and passcode columns
-- ✓ Migrated data from is_public/requires_auth to access_level
-- ✓ Dropped old columns
-- ✓ Rewrote user_has_document_access() function
-- ✓ Updated RLS policies for new permission model
-- ✓ Added policies to restrict document modifications to owner admins
-- ✓ Updated helper views

