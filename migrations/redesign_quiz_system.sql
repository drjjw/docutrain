-- Migration: Redesign Quiz System
-- Created: 2025-01-XX
-- Description: Restructures quiz system so questions are directly associated with documents.
--              Questions form a bank per document, and quiz attempts reference documents directly.
--              Keeps minimal quizzes table for regeneration tracking.

-- =====================================================
-- Step 1: Add document_slug column to quiz_questions
-- =====================================================
ALTER TABLE quiz_questions
ADD COLUMN IF NOT EXISTS document_slug TEXT REFERENCES documents(slug) ON DELETE CASCADE;

-- =====================================================
-- Step 2: Migrate existing data - copy document_slug from quizzes table
-- =====================================================
UPDATE quiz_questions qq
SET document_slug = q.document_slug
FROM quizzes q
WHERE qq.quiz_id = q.id AND qq.document_slug IS NULL;

-- =====================================================
-- Step 3: Make document_slug NOT NULL after migration
-- =====================================================
ALTER TABLE quiz_questions
ALTER COLUMN document_slug SET NOT NULL;

-- =====================================================
-- Step 4: Remove question_index column (no longer needed)
-- =====================================================
-- First drop the unique constraint if it exists
ALTER TABLE quiz_questions
DROP CONSTRAINT IF EXISTS quiz_questions_quiz_id_question_index_key;

-- Drop the index if it exists
DROP INDEX IF EXISTS idx_quiz_questions_quiz_id_index;

-- Remove the column
ALTER TABLE quiz_questions
DROP COLUMN IF EXISTS question_index;

-- =====================================================
-- Step 5: Remove quiz_id foreign key from quiz_questions
-- =====================================================
-- First drop the foreign key constraint
ALTER TABLE quiz_questions
DROP CONSTRAINT IF EXISTS quiz_questions_quiz_id_fkey;

-- Remove the column
ALTER TABLE quiz_questions
DROP COLUMN IF EXISTS quiz_id;

-- =====================================================
-- Step 6: Add document_slug column to quiz_attempts
-- =====================================================
ALTER TABLE quiz_attempts
ADD COLUMN IF NOT EXISTS document_slug TEXT REFERENCES documents(slug) ON DELETE CASCADE;

-- =====================================================
-- Step 7: Migrate existing attempts - copy document_slug from quizzes table
-- =====================================================
UPDATE quiz_attempts qa
SET document_slug = q.document_slug
FROM quizzes q
WHERE qa.quiz_id = q.id AND qa.document_slug IS NULL;

-- =====================================================
-- Step 8: Make document_slug NOT NULL after migration
-- =====================================================
ALTER TABLE quiz_attempts
ALTER COLUMN document_slug SET NOT NULL;

-- =====================================================
-- Step 9: Remove quiz_id foreign key from quiz_attempts
-- =====================================================
-- First drop indexes that depend on quiz_id
DROP INDEX IF EXISTS idx_quiz_attempts_quiz_id;
DROP INDEX IF EXISTS idx_quiz_attempts_quiz_user;

-- Drop the foreign key constraint
ALTER TABLE quiz_attempts
DROP CONSTRAINT IF EXISTS quiz_attempts_quiz_id_fkey;

-- Remove the column
ALTER TABLE quiz_attempts
DROP COLUMN IF EXISTS quiz_id;

-- =====================================================
-- Step 10: Add indexes for new structure
-- =====================================================
-- Index for quiz_questions by document_slug
CREATE INDEX IF NOT EXISTS idx_quiz_questions_document_slug ON quiz_questions(document_slug);

-- Indexes for quiz_attempts by document_slug
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_document_slug ON quiz_attempts(document_slug);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_document_user ON quiz_attempts(document_slug, user_id);

-- =====================================================
-- Step 11: Ensure question_ids column exists in quiz_attempts (from restructure migration)
-- =====================================================
ALTER TABLE quiz_attempts
ADD COLUMN IF NOT EXISTS question_ids JSONB;

-- Create index for question_ids if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_question_ids ON quiz_attempts USING GIN (question_ids);

COMMENT ON COLUMN quiz_attempts.question_ids IS 'Array of question IDs (UUIDs) that were used in this quiz attempt. Stored as JSONB array.';

-- =====================================================
-- Step 12: Update comments
-- =====================================================
COMMENT ON TABLE quiz_questions IS 'Stores quiz questions directly associated with documents. Questions form a bank per document.';
COMMENT ON COLUMN quiz_questions.document_slug IS 'Foreign key to documents.slug - questions are directly associated with documents';
COMMENT ON TABLE quiz_attempts IS 'Stores user quiz attempts with scores. References documents directly.';
COMMENT ON COLUMN quiz_attempts.document_slug IS 'Foreign key to documents.slug - attempt is for this document';

-- =====================================================
-- Step 13: Update RLS Policies for quiz_questions
-- =====================================================
-- Drop old policies
DROP POLICY IF EXISTS "Authenticated users can read quiz questions" ON quiz_questions;
DROP POLICY IF EXISTS "Service role can manage quiz questions" ON quiz_questions;

-- Create new policies that work with document_slug
-- Authenticated users can read quiz questions (same as before)
CREATE POLICY "Authenticated users can read quiz questions" ON quiz_questions
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Service role can manage quiz questions (for backend generation)
CREATE POLICY "Service role can manage quiz questions" ON quiz_questions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- Step 14: Update RLS Policies for quiz_attempts
-- =====================================================
-- Drop old policies
DROP POLICY IF EXISTS "Users can read own attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Users can create own attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Service role can manage attempts" ON quiz_attempts;

-- Create new policies that work with document_slug
-- Users can read their own attempts
CREATE POLICY "Users can read own attempts" ON quiz_attempts
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Authenticated users can create their own attempts (unlimited)
CREATE POLICY "Users can create own attempts" ON quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Service role can manage all attempts
CREATE POLICY "Service role can manage attempts" ON quiz_attempts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- Step 15: Keep minimal quizzes table for regeneration tracking
-- =====================================================
-- The quizzes table will remain but only be used for:
-- - Tracking when questions were generated (for 7-day regeneration limit)
-- - Tracking generation status
-- - Tracking who generated questions
-- 
-- We'll keep it simple - one row per document with generation metadata
-- Questions and attempts no longer reference it

COMMENT ON TABLE quizzes IS 'Minimal metadata table for tracking question generation. Used for regeneration limits and status tracking. Questions and attempts no longer reference this table.';

-- =====================================================
-- Summary of Changes:
-- =====================================================
-- 1. quiz_questions.document_slug: Direct link to documents (replaces quiz_id)
-- 2. quiz_questions.question_index: Removed (no longer needed)
-- 3. quiz_attempts.document_slug: Direct link to documents (replaces quiz_id)
-- 4. quiz_attempts.question_ids: JSONB array of question IDs (already exists)
-- 5. quizzes table: Kept for regeneration tracking only
-- 6. RLS policies: Updated to work with new structure


