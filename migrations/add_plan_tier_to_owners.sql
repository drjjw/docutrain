-- Migration: Add Plan Tier to Owners Table
-- Created: 2025-01-XX
-- Description: Add plan_tier column to owners table for feature tier management

-- Add plan_tier column with CHECK constraint
ALTER TABLE owners
ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'pro'
CHECK (plan_tier IN ('free', 'pro', 'enterprise', 'unlimited'));

-- Add comment
COMMENT ON COLUMN owners.plan_tier IS 'Feature tier: free (1 doc), pro (5 docs, no voice), enterprise (10 docs, voice), unlimited (no limits)';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_owners_plan_tier ON owners(plan_tier);

