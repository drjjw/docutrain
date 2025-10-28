-- Migration: Optimize Document Access Checks
-- Created: 2025-10-28
-- Description: Add batch access check function to reduce database calls

-- =====================================================
-- Batch Access Check Function
-- =====================================================

-- Function to check access for multiple documents at once
CREATE OR REPLACE FUNCTION user_has_multiple_document_access(
  p_user_id UUID,
  p_document_slugs TEXT[]
) RETURNS TABLE(
  document_slug TEXT,
  has_access BOOLEAN
) AS $$
DECLARE
  doc_record RECORD;
BEGIN
  -- For each requested document slug
  FOREACH doc_record IN
    SELECT
      d.slug,
      d.id,
      d.owner_id,
      d.access_level,
      d.passcode
    FROM documents d
    WHERE d.slug = ANY(p_document_slugs)
    AND d.active = true
  LOOP
    -- Check access for this document
    DECLARE
      access_result BOOLEAN := false;
      is_super_admin BOOLEAN := false;
      is_owner_member BOOLEAN := false;
      is_owner_admin BOOLEAN := false;
    BEGIN
      -- PUBLIC: Anyone can access
      IF doc_record.access_level = 'public' THEN
        access_result := true;
      -- PASSCODE: For now, treat as public (passcode validation not yet implemented)
      ELSIF doc_record.access_level = 'passcode' THEN
        access_result := true;
      -- REGISTERED: Any logged-in user can access
      ELSIF doc_record.access_level = 'registered' THEN
        access_result := p_user_id IS NOT NULL;
      -- For owner-restricted levels, user must be logged in
      ELSIF p_user_id IS NULL THEN
        access_result := false;
      ELSE
        -- Check if user is super admin (can access everything)
        SELECT EXISTS(
          SELECT 1 FROM user_roles
          WHERE user_id = p_user_id
          AND role = 'super_admin'
        ) INTO is_super_admin;

        IF is_super_admin THEN
          access_result := true;
        -- Document has no owner but requires owner access → deny
        ELSIF doc_record.owner_id IS NULL THEN
          access_result := false;
        -- OWNER_RESTRICTED: Check if user is member of owner group
        ELSIF doc_record.access_level = 'owner_restricted' THEN
          SELECT EXISTS(
            -- Check user_owner_access table (regular members)
            SELECT 1 FROM user_owner_access
            WHERE user_id = p_user_id AND owner_id = doc_record.owner_id
            UNION
            -- Check user_roles table (owner admins and registered users)
            SELECT 1 FROM user_roles
            WHERE user_id = p_user_id
            AND owner_id = doc_record.owner_id
            AND role IN ('owner_admin', 'registered')
          ) INTO is_owner_member;

          access_result := is_owner_member;
        -- OWNER_ADMIN_ONLY: Check if user is owner admin
        ELSIF doc_record.access_level = 'owner_admin_only' THEN
          SELECT EXISTS(
            SELECT 1 FROM user_roles
            WHERE user_id = p_user_id
            AND owner_id = doc_record.owner_id
            AND role = 'owner_admin'
          ) INTO is_owner_admin;

          access_result := is_owner_admin;
        END IF;
      END IF;

      -- Return result for this document
      document_slug := doc_record.slug;
      has_access := access_result;
      RETURN NEXT;
    END;
  END LOOP;

  -- Handle documents that don't exist in database
  DECLARE
    existing_slugs TEXT[];
  BEGIN
    SELECT array_agg(slug)
    INTO existing_slugs
    FROM documents
    WHERE slug = ANY(p_document_slugs);

    -- For non-existent documents, return false
    FOR i IN 1..array_length(p_document_slugs, 1) LOOP
      IF NOT (p_document_slugs[i] = ANY(existing_slugs)) THEN
        document_slug := p_document_slugs[i];
        has_access := false;
        RETURN NEXT;
      END IF;
    END LOOP;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Grant Permissions
-- =====================================================

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION user_has_multiple_document_access(UUID, TEXT[]) TO authenticated;

-- =====================================================
-- Update Documents API to Use Batch Access Check
-- =====================================================

/*
-- To use this in the Node.js API, replace the individual access checks with:

const { data: accessResults, error } = await supabase
  .rpc('user_has_multiple_document_access', {
    p_user_id: userId,
    p_document_slugs: docSlugs
  });

if (error) {
  console.error('Batch access check error:', error);
  // Fallback to individual checks
} else {
  // Process results
  const accessMap = {};
  accessResults.forEach(result => {
    accessMap[result.document_slug] = result.has_access;
  });
  // Use accessMap instead of individual checks
}

This should reduce database round trips from N (one per document) to 1.
*/
