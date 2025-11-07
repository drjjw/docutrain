-- Migration: Add User Invitations Table
-- Created: 2025-01-XX
-- Description: Track user invitations sent by owner admins for automatic signup and group assignment

-- =====================================================
-- Table: user_invitations
-- Purpose: Track invitations sent to users for signup
-- =====================================================
CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  invite_token TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_invitations IS 'Tracks invitations sent to users for signup. Invited users skip email verification and are automatically added to owner group.';
COMMENT ON COLUMN user_invitations.invite_token IS 'Secure random token used in signup URL. Single-use, expires after 30 days.';
COMMENT ON COLUMN user_invitations.expires_at IS 'Invitation expiration timestamp (30 days from creation)';
COMMENT ON COLUMN user_invitations.used_at IS 'Timestamp when invitation was redeemed. NULL if not yet used.';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_invitations_invite_token ON user_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_owner_id ON user_invitations(owner_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_expires_at ON user_invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_invitations_used_at ON user_invitations(used_at) WHERE used_at IS NULL;

-- Enable Row Level Security
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Service role can manage all invitations (for edge functions and backend)
CREATE POLICY "Service role can manage invitations" ON user_invitations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Owner admins can view invitations for their owner groups
CREATE POLICY "Owner admins can view their invitations" ON user_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'owner_admin'
        AND ur.owner_id = user_invitations.owner_id
    )
  );

-- Super admins can view all invitations
CREATE POLICY "Super admins can view all invitations" ON user_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
    )
  );

-- Updated_at trigger function (reuse existing if available)
CREATE OR REPLACE FUNCTION update_user_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to user_invitations table
CREATE TRIGGER update_user_invitations_updated_at
  BEFORE UPDATE ON user_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_user_invitations_updated_at();

