-- Migration: Add user profiles table with TOS acceptance tracking
-- Created: 2025-10-31
-- Description: Track user profile data including Terms of Service acceptance

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tos_accepted_at TIMESTAMPTZ,
  tos_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can insert their own profile (during signup)
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can insert/update profiles (for signup triggers)
CREATE POLICY "Service role can manage profiles" ON user_profiles
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comment
COMMENT ON TABLE user_profiles IS 'User profile data including TOS acceptance tracking';
COMMENT ON COLUMN user_profiles.tos_accepted_at IS 'Timestamp when user accepted Terms of Service';
COMMENT ON COLUMN user_profiles.tos_version IS 'Version of TOS that was accepted (e.g., effective date)';




