-- Fix access for user-uploaded documents (owner_restricted with owner_id = null)
-- These documents should be accessible to the user who uploaded them (metadata.user_id)

CREATE OR REPLACE FUNCTION user_has_document_access(
  p_user_id UUID,
  p_document_id UUID,
  p_passcode TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  doc_owner_id UUID;
  doc_access_level document_access_level;
  doc_passcode TEXT;
  doc_metadata JSONB;
  doc_user_id UUID;
  is_super_admin BOOLEAN;
  is_owner_member BOOLEAN;
  is_owner_admin BOOLEAN;
BEGIN
  -- Get document info including metadata
  SELECT owner_id, access_level, passcode, metadata
  INTO doc_owner_id, doc_access_level, doc_passcode, doc_metadata
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
  
  -- PASSCODE: Validate passcode if provided
  IF doc_access_level = 'passcode' THEN
    -- If document has no passcode set, treat as public
    IF doc_passcode IS NULL OR doc_passcode = '' THEN
      RETURN true;
    END IF;
    
    -- If passcode provided, check if it matches (case-sensitive)
    IF p_passcode IS NOT NULL AND p_passcode = doc_passcode THEN
      RETURN true;
    END IF;
    
    -- No passcode provided or incorrect passcode
    RETURN false;
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
  
  -- OWNER_RESTRICTED: Check access
  IF doc_access_level = 'owner_restricted' THEN
    -- If document has no owner_id but has metadata.user_id, check if user matches uploader
    IF doc_owner_id IS NULL AND doc_metadata IS NOT NULL THEN
      doc_user_id := (doc_metadata->>'user_id')::UUID;
      IF doc_user_id = p_user_id THEN
        RETURN true; -- User uploaded this document
      END IF;
    END IF;
    
    -- Document has no owner and user doesn't match → deny
    IF doc_owner_id IS NULL THEN
      RETURN false;
    END IF;
    
    -- Document has owner_id - check owner group membership
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
    -- Document has no owner but requires owner admin → deny
    IF doc_owner_id IS NULL THEN
      RETURN false;
    END IF;
    
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

COMMENT ON FUNCTION user_has_document_access IS 'Check if user has permission to access a document based on access_level and owner group membership. For user-uploaded documents (owner_restricted with owner_id=null), checks metadata.user_id against current user.';

