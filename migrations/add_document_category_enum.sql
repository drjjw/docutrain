-- Create enum type for document categories
CREATE TYPE document_category AS ENUM (
    'Guidelines',
    'Maker',
    'Manuals',
    'Presentation',
    'Recipes',
    'Reviews',
    'Slides',
    'Training'
);

-- Alter the category column to use the enum type
ALTER TABLE documents
ALTER COLUMN category TYPE document_category
USING CASE
    WHEN category = 'presentation' THEN 'Presentation'::document_category
    WHEN category = 'recipes' THEN 'Recipes'::document_category
    WHEN category = 'slides' THEN 'Slides'::document_category
    WHEN category = 'training' THEN 'Training'::document_category
    ELSE category::document_category
END;

-- Add comment to the column
COMMENT ON COLUMN documents.category IS 'Document category for organization and filtering purposes';

