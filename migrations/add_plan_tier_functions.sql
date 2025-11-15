-- Migration: Add Plan Tier Helper Functions
-- Created: 2025-01-XX
-- Description: Create helper functions for plan tier checks and quota management

-- Function to get owner plan tier
CREATE OR REPLACE FUNCTION get_owner_plan_tier(p_owner_id UUID)
RETURNS TEXT AS $$
DECLARE
    tier TEXT;
BEGIN
    SELECT plan_tier INTO tier
    FROM owners
    WHERE id = p_owner_id;
    
    RETURN COALESCE(tier, 'pro'); -- Default to 'pro' if not found
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_owner_plan_tier IS 'Get the plan tier for an owner (free, pro, enterprise, unlimited)';

-- Function to get owner document limit
CREATE OR REPLACE FUNCTION get_owner_document_limit(p_owner_id UUID)
RETURNS INTEGER AS $$
DECLARE
    tier TEXT;
BEGIN
    SELECT plan_tier INTO tier
    FROM owners
    WHERE id = p_owner_id;
    
    -- Return NULL for unlimited (no limit)
    CASE COALESCE(tier, 'pro')
        WHEN 'free' THEN RETURN 1;
        WHEN 'pro' THEN RETURN 5;
        WHEN 'enterprise' THEN RETURN 10;
        WHEN 'unlimited' THEN RETURN NULL;
        ELSE RETURN 5; -- Default to pro limit
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_owner_document_limit IS 'Get the document limit for an owner (1, 5, 10, or NULL for unlimited)';

-- Function to get owner document count
CREATE OR REPLACE FUNCTION get_owner_document_count(p_owner_id UUID)
RETURNS INTEGER AS $$
DECLARE
    doc_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO doc_count
    FROM documents
    WHERE owner_id = p_owner_id
    AND active = true;
    
    RETURN COALESCE(doc_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_owner_document_count IS 'Get the current count of active documents for an owner';

-- Function to check if owner can upload document
CREATE OR REPLACE FUNCTION can_owner_upload_document(p_owner_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    tier TEXT;
    limit_count INTEGER;
    current_count INTEGER;
BEGIN
    -- Get plan tier
    SELECT plan_tier INTO tier
    FROM owners
    WHERE id = p_owner_id;
    
    -- Unlimited tier can always upload
    IF COALESCE(tier, 'pro') = 'unlimited' THEN
        RETURN TRUE;
    END IF;
    
    -- Get limit and current count
    limit_count := get_owner_document_limit(p_owner_id);
    current_count := get_owner_document_count(p_owner_id);
    
    -- Check if under limit
    IF limit_count IS NULL THEN
        RETURN TRUE; -- Unlimited
    END IF;
    
    RETURN current_count < limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_owner_upload_document IS 'Check if owner can upload a new document (returns true if under limit or unlimited)';

-- Function to check if owner can use voice training
CREATE OR REPLACE FUNCTION can_owner_use_voice_training(p_owner_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    tier TEXT;
BEGIN
    SELECT plan_tier INTO tier
    FROM owners
    WHERE id = p_owner_id;
    
    -- Only enterprise and unlimited can use voice training
    RETURN COALESCE(tier, 'pro') IN ('enterprise', 'unlimited');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_owner_use_voice_training IS 'Check if owner can use voice training (enterprise and unlimited only)';

