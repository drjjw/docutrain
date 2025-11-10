-- Add deprecation comment to category column
-- This column is kept for backward compatibility but will be removed in a future migration
-- New code should use category_id instead

COMMENT ON COLUMN documents.category IS 'DEPRECATED: Use category_id instead. This column is kept for backward compatibility and will be removed in a future migration.';

