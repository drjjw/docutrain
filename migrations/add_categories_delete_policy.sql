-- Migration: Add DELETE policy for categories table
-- Allows users to delete categories they created, or super admins to delete any category
-- Date: 2025-01-XX

-- Allow authenticated users to delete categories they created
CREATE POLICY "Allow authenticated delete own categories" 
ON categories 
FOR DELETE 
TO authenticated
USING (
  -- User can delete categories they created
  created_by = auth.uid()
  OR
  -- Super admins can delete any category
  EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

COMMENT ON POLICY "Allow authenticated delete own categories" ON categories IS 
'Allows users to delete categories they created, or super admins to delete any category';

