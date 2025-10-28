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
  current_slug TEXT;
  doc_record RECORD;
  access_result BOOLEAN;
BEGIN
  -- For each requested document slug
  FOREACH current_slug IN ARRAY p_document_slugs LOOP
    -- Get document info
    SELECT
      d.id,
      d.owner_id,
      d.access_level
    INTO doc_record
    FROM documents d
    WHERE d.slug = current_slug
    AND d.active = true;

    -- Default to no access
    access_result := false;

    -- If document exists
    IF FOUND THEN
      -- PUBLIC: Anyone can access
      IF doc_record.access_level = 'public' THEN
        access_result := true;
      -- PASSCODE: For now, treat as public
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
        IF EXISTS(
          SELECT 1 FROM user_roles
          WHERE user_id = p_user_id
          AND role = 'super_admin'
        ) THEN
          access_result := true;
        -- Document has no owner but requires owner access → deny
        ELSIF doc_record.owner_id IS NULL THEN
          access_result := false;
        -- OWNER_RESTRICTED: Check if user is member of owner group
        ELSIF doc_record.access_level = 'owner_restricted' THEN
          IF EXISTS(
            SELECT 1 FROM user_owner_access
            WHERE user_id = p_user_id AND owner_id = doc_record.owner_id
            UNION
            SELECT 1 FROM user_roles
            WHERE user_id = p_user_id
            AND owner_id = doc_record.owner_id
            AND role IN ('owner_admin', 'registered')
          ) THEN
            access_result := true;
          END IF;
        -- OWNER_ADMIN_ONLY: Check if user is owner admin
        ELSIF doc_record.access_level = 'owner_admin_only' THEN
          IF EXISTS(
            SELECT 1 FROM user_roles
            WHERE user_id = p_user_id
            AND owner_id = doc_record.owner_id
            AND role = 'owner_admin'
          ) THEN
            access_result := true;
          END IF;
        END IF;
      END IF;
    END IF;

    -- Return result for this document
    document_slug := current_slug;
    has_access := access_result;
    RETURN NEXT;
  END LOOP;

  RETURN;
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
