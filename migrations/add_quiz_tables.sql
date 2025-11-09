-- Migration: Add Quiz Tables and Pre-Generation Support
-- Created: 2025-01-XX
-- Description: Creates tables for storing pre-generated quizzes, questions, and attempts

-- =====================================================
-- Table: quizzes
-- Purpose: Store quiz metadata for each document
-- =====================================================
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_slug TEXT NOT NULL REFERENCES documents(slug) ON DELETE CASCADE,
  num_questions INTEGER NOT NULL CHECK (num_questions > 0),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_slug)
);

COMMENT ON TABLE quizzes IS 'Stores quiz metadata for each document. One quiz set per document.';
COMMENT ON COLUMN quizzes.document_slug IS 'Foreign key to documents.slug - one quiz set per document';
COMMENT ON COLUMN quizzes.num_questions IS 'Number of questions in this quiz';
COMMENT ON COLUMN quizzes.generated_at IS 'Timestamp when quizzes were generated (used for 7-day regeneration limit)';
COMMENT ON COLUMN quizzes.status IS 'Generation status: generating, completed, or failed';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quizzes_document_slug ON quizzes(document_slug);
CREATE INDEX IF NOT EXISTS idx_quizzes_generated_at ON quizzes(generated_at);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);

-- =====================================================
-- Table: quiz_questions
-- Purpose: Store individual quiz questions
-- =====================================================
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL CHECK (question_index >= 0),
  question TEXT NOT NULL,
  options JSONB NOT NULL CHECK (jsonb_array_length(options) = 4),
  correct_answer INTEGER NOT NULL CHECK (correct_answer >= 0 AND correct_answer <= 3),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quiz_id, question_index)
);

COMMENT ON TABLE quiz_questions IS 'Stores individual quiz questions for each quiz';
COMMENT ON COLUMN quiz_questions.question_index IS 'Order of question (0-based)';
COMMENT ON COLUMN quiz_questions.options IS 'JSONB array of exactly 4 option strings';
COMMENT ON COLUMN quiz_questions.correct_answer IS 'Index of correct answer (0-3)';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id_index ON quiz_questions(quiz_id, question_index);

-- =====================================================
-- Table: quiz_attempts
-- Purpose: Store user quiz attempts and scores
-- =====================================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  total_questions INTEGER NOT NULL CHECK (total_questions > 0),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE quiz_attempts IS 'Stores user quiz attempts with scores. Unlimited attempts allowed per user.';
COMMENT ON COLUMN quiz_attempts.user_id IS 'User ID if authenticated, NULL for anonymous attempts';
COMMENT ON COLUMN quiz_attempts.score IS 'Number of correct answers';
COMMENT ON COLUMN quiz_attempts.total_questions IS 'Total number of questions in the quiz';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_user ON quiz_attempts(quiz_id, user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_completed_at ON quiz_attempts(completed_at DESC);

-- =====================================================
-- Add quizzes_generated column to documents table
-- =====================================================
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS quizzes_generated BOOLEAN DEFAULT false;

-- Backfill existing documents with quizzes_generated = false
UPDATE documents
SET quizzes_generated = false
WHERE quizzes_generated IS NULL;

COMMENT ON COLUMN documents.quizzes_generated IS 'Indicates if quizzes have been generated for this document. Controls enable/disable of show_quizzes toggle.';

-- =====================================================
-- Enable Row Level Security
-- =====================================================
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies: quizzes
-- =====================================================

-- Authenticated users can read quizzes
CREATE POLICY "Authenticated users can read quizzes" ON quizzes
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Service role can manage quizzes (for backend generation)
CREATE POLICY "Service role can manage quizzes" ON quizzes
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- RLS Policies: quiz_questions
-- =====================================================

-- Authenticated users can read quiz questions
CREATE POLICY "Authenticated users can read quiz questions" ON quiz_questions
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Service role can manage quiz questions (for backend generation)
CREATE POLICY "Service role can manage quiz questions" ON quiz_questions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- RLS Policies: quiz_attempts
-- =====================================================

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
-- Updated_at trigger function (if not exists)
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to quizzes table
CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON quizzes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

