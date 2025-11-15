-- Migration: Set Default Plan Tiers
-- Created: 2025-01-XX
-- Description: Set default plan tiers for all existing owners

-- Set all owners to 'pro' by default
UPDATE owners
SET plan_tier = 'pro'
WHERE plan_tier IS NULL OR plan_tier = 'pro';

-- Set DocuTrain and UKidney to 'unlimited'
UPDATE owners
SET plan_tier = 'unlimited'
WHERE slug IN ('docutrain', 'ukidney');

