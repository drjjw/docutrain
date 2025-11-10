-- Migration: Fix slug update cascade for quiz tables
-- Created: 2025-01-XX
-- Description: Updates foreign key constraints on quiz-related tables to allow 
--              document slug updates with CASCADE. Previously, these constraints
--              had ON UPDATE NO ACTION which prevented slug updates.

-- =====================================================
-- Fix quizzes table foreign key
-- =====================================================
ALTER TABLE quizzes
DROP CONSTRAINT IF EXISTS quizzes_document_slug_fkey;

ALTER TABLE quizzes
ADD CONSTRAINT quizzes_document_slug_fkey
FOREIGN KEY (document_slug) 
REFERENCES documents(slug) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- =====================================================
-- Fix quiz_questions table foreign key
-- =====================================================
ALTER TABLE quiz_questions
DROP CONSTRAINT IF EXISTS quiz_questions_document_slug_fkey;

ALTER TABLE quiz_questions
ADD CONSTRAINT quiz_questions_document_slug_fkey
FOREIGN KEY (document_slug) 
REFERENCES documents(slug) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- =====================================================
-- Fix quiz_attempts table foreign key
-- =====================================================
ALTER TABLE quiz_attempts
DROP CONSTRAINT IF EXISTS quiz_attempts_document_slug_fkey;

ALTER TABLE quiz_attempts
ADD CONSTRAINT quiz_attempts_document_slug_fkey
FOREIGN KEY (document_slug) 
REFERENCES documents(slug) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT quizzes_document_slug_fkey ON quizzes IS 
  'Foreign key to documents.slug with CASCADE on update and delete';

COMMENT ON CONSTRAINT quiz_questions_document_slug_fkey ON quiz_questions IS 
  'Foreign key to documents.slug with CASCADE on update and delete';

COMMENT ON CONSTRAINT quiz_attempts_document_slug_fkey ON quiz_attempts IS 
  'Foreign key to documents.slug with CASCADE on update and delete';

