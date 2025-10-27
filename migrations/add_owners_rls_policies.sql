-- Migration: Add RLS Policies for Owners Table
-- Created: 2025-10-23
-- Description: Add Row Level Security policies to allow super admins to access the owners table

-- =====================================================
-- Enable RLS on owners table (if not already enabled)
-- =====================================================
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies for owners table
-- =====================================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Super admins read all owners" ON owners;
DROP POLICY IF EXISTS "Super admins manage owners" ON owners;

-- Super admins can read all owners
CREATE POLICY "Super admins read all owners" ON owners
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Super admins can manage all owners
CREATE POLICY "Super admins manage owners" ON owners
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Allow reading owner info for any active document (for login branding)
CREATE POLICY "Read owners for active documents" ON owners
  FOR SELECT USING (
    id IN (
      SELECT owner_id FROM documents
      WHERE active = true
    )
  );
