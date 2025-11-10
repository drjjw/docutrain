-- Migration: Restructure Quiz System to Question Bank Model
-- Created: 2025-01-XX
-- Description: Restructures quiz system so questions form a bank, and each quiz attempt
--              randomly selects 5 questions from the bank. This allows multiple attempts
--              with different question sets.

-- =====================================================
-- Step 1: Add quiz_size column to quizzes table
-- =====================================================
-- This stores how many questions each quiz attempt should have (default: 5)
ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS quiz_size INTEGER NOT NULL DEFAULT 5 CHECK (quiz_size > 0);

COMMENT ON COLUMN quizzes.quiz_size IS 'Number of questions per quiz attempt (default: 5). Questions are randomly selected from the bank.';

-- Update existing quizzes to have quiz_size = 5
UPDATE quizzes
SET quiz_size = 5
WHERE quiz_size IS NULL;

-- =====================================================
-- Step 2: Rename num_questions to bank_size for clarity
-- =====================================================
-- num_questions now represents the size of the question bank, not quiz size
ALTER TABLE quizzes
RENAME COLUMN num_questions TO bank_size;

COMMENT ON COLUMN quizzes.bank_size IS 'Total number of questions in the question bank for this document';

-- =====================================================
-- Step 3: Make question_index nullable and remove unique constraint
-- =====================================================
-- Questions no longer need ordering since they're randomly selected
-- First, drop the unique constraint
ALTER TABLE quiz_questions
DROP CONSTRAINT IF EXISTS quiz_questions_quiz_id_question_index_key;

-- Make question_index nullable (existing questions keep their index for reference)
ALTER TABLE quiz_questions
ALTER COLUMN question_index DROP NOT NULL;

COMMENT ON COLUMN quiz_questions.question_index IS 'Optional ordering index (legacy). Questions are now randomly selected from the bank.';

-- =====================================================
-- Step 4: Add question_ids column to quiz_attempts
-- =====================================================
-- Store which questions were used in each attempt
ALTER TABLE quiz_attempts
ADD COLUMN IF NOT EXISTS question_ids JSONB;

COMMENT ON COLUMN quiz_attempts.question_ids IS 'Array of question IDs (UUIDs) that were used in this quiz attempt. Stored as JSONB array.';

-- Create index for querying attempts by question IDs
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_question_ids ON quiz_attempts USING GIN (question_ids);

-- =====================================================
-- Step 5: Backfill question_ids for existing attempts (if any)
-- =====================================================
-- For existing attempts, we can't know which questions were used,
-- so we'll leave them NULL. New attempts will always have question_ids.

-- =====================================================
-- Step 6: Update indexes
-- =====================================================
-- Remove the composite index on quiz_id + question_index since ordering is no longer important
DROP INDEX IF EXISTS idx_quiz_questions_quiz_id_index;

-- Keep the quiz_id index for fast lookups
-- (idx_quiz_questions_quiz_id already exists)

-- =====================================================
-- Step 7: Add constraint to ensure total_questions matches quiz_size
-- =====================================================
-- This ensures data consistency (though we'll enforce it in application code)
-- Note: We can't add a foreign key constraint here since total_questions is in quiz_attempts
-- and quiz_size is in quizzes, but we'll validate in application code.

-- =====================================================
-- Summary of Changes:
-- =====================================================
-- 1. quizzes.bank_size: Total questions in bank (was num_questions)
-- 2. quizzes.quiz_size: Questions per attempt (default: 5)
-- 3. quiz_questions.question_index: Now nullable, no unique constraint
-- 4. quiz_attempts.question_ids: JSONB array of question IDs used in attempt
-- 5. Removed ordering requirement for questions


