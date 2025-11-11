-- Migration: Change Quiz Questions from 4 to 5 Options
-- Created: 2025-01-XX
-- Description: Updates quiz system to support 5 multiple-choice options (A-E) instead of 4 (A-D).
--              This is a breaking change - all existing quiz questions will be deleted as they
--              are incompatible with the new format.

-- =====================================================
-- Step 1: Delete all existing quiz questions
-- =====================================================
-- Existing questions have 4 options and cannot be migrated to 5 options format
-- Users will need to regenerate quizzes after this migration
DELETE FROM quiz_questions;

-- =====================================================
-- Step 2: Update quizzes status to 'failed' for any existing quizzes
-- =====================================================
-- Mark existing quizzes as failed since their questions were deleted
UPDATE quizzes
SET status = 'failed'
WHERE status = 'completed';

-- =====================================================
-- Step 3: Drop existing constraints on quiz_questions
-- =====================================================
-- Drop the check constraint on options array length
ALTER TABLE quiz_questions
DROP CONSTRAINT IF EXISTS quiz_questions_options_check;

-- Drop the check constraint on correct_answer range
ALTER TABLE quiz_questions
DROP CONSTRAINT IF EXISTS quiz_questions_correct_answer_check;

-- =====================================================
-- Step 4: Add new constraints for 5 options
-- =====================================================
-- Add constraint to ensure exactly 5 options
ALTER TABLE quiz_questions
ADD CONSTRAINT quiz_questions_options_check 
CHECK (jsonb_array_length(options) = 5);

-- Add constraint to ensure correct_answer is 0-4 (for 5 options)
ALTER TABLE quiz_questions
ADD CONSTRAINT quiz_questions_correct_answer_check 
CHECK (correct_answer >= 0 AND correct_answer <= 4);

-- =====================================================
-- Step 5: Update column comments
-- =====================================================
COMMENT ON COLUMN quiz_questions.options IS 'JSONB array of exactly 5 option strings (A, B, C, D, E)';
COMMENT ON COLUMN quiz_questions.correct_answer IS 'Index of correct answer (0-4, where 0=A, 1=B, 2=C, 3=D, 4=E)';

-- =====================================================
-- Summary of Changes:
-- =====================================================
-- 1. Deleted all existing quiz_questions (incompatible with new format)
-- 2. Updated existing quizzes status to 'failed' (require regeneration)
-- 3. Changed options constraint from 4 to 5 options
-- 4. Changed correct_answer constraint from 0-3 to 0-4
-- 5. Updated column comments to reflect 5 options



