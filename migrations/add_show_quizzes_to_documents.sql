-- Migration: Add Show Quizzes Option to Documents
-- Adds option to show/hide quiz feature for each document
-- Date: 2025-01-XX

-- Add show_quizzes BOOLEAN column (defaults to false)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS show_quizzes BOOLEAN DEFAULT false;

-- Backfill existing documents with show_quizzes = false
UPDATE documents
SET show_quizzes = false
WHERE show_quizzes IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN documents.show_quizzes IS 'Show quiz button in document interface. Defaults to false.';


