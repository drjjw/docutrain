# Quiz Pre-Generation System

## Overview

The Quiz Pre-Generation System allows administrators to generate and store quiz questions for documents in advance, rather than generating them on-demand. Quizzes are stored in the database and can be enabled/disabled per document. Users can take quizzes multiple times with unlimited attempts, and scores are tracked.

## Status: In Progress

This feature is currently being implemented and tested. The core functionality is complete, but may require adjustments based on usage patterns.

## Database Schema

### Table: `quizzes`

Stores quiz metadata for each document. One quiz set per document.

**Columns:**
- `id` (UUID, PRIMARY KEY) - Unique quiz identifier
- `document_slug` (TEXT, UNIQUE, FOREIGN KEY) - References `documents.slug`
- `num_questions` (INTEGER) - Number of questions in this quiz
- `generated_at` (TIMESTAMPTZ) - Timestamp when quizzes were generated (used for 7-day regeneration limit)
- `generated_by` (UUID, NULLABLE) - User ID who triggered generation (references `auth.users`)
- `status` (TEXT) - Generation status: 'generating', 'completed', or 'failed'
- `created_at` (TIMESTAMPTZ) - Record creation timestamp
- `updated_at` (TIMESTAMPTZ) - Last update timestamp

**Indexes:**
- `idx_quizzes_document_slug` - Fast lookup by document
- `idx_quizzes_generated_at` - For regeneration limit checks
- `idx_quizzes_status` - Filter by status

### Table: `quiz_questions`

Stores individual quiz questions for each quiz.

**Columns:**
- `id` (UUID, PRIMARY KEY) - Unique question identifier
- `quiz_id` (UUID, FOREIGN KEY) - References `quizzes.id`
- `question_index` (INTEGER) - Order of question (0-based)
- `question` (TEXT) - Question text
- `options` (JSONB) - Array of exactly 5 option strings
- `correct_answer` (INTEGER) - Index of correct answer (0-4)
- `created_at` (TIMESTAMPTZ) - Record creation timestamp

**Constraints:**
- `UNIQUE(quiz_id, question_index)` - One question per index per quiz
- `CHECK(jsonb_array_length(options) = 5)` - Exactly 5 options required
- `CHECK(correct_answer >= 0 AND correct_answer <= 4)` - Valid answer index

**Indexes:**
- `idx_quiz_questions_quiz_id` - Fast lookup by quiz
- `idx_quiz_questions_quiz_id_index` - Ordered retrieval

### Table: `quiz_attempts`

Stores user quiz attempts with scores. Unlimited attempts allowed per user.

**Columns:**
- `id` (UUID, PRIMARY KEY) - Unique attempt identifier
- `quiz_id` (UUID, FOREIGN KEY) - References `quizzes.id`
- `user_id` (UUID, NULLABLE) - User ID if authenticated (references `auth.users`)
- `score` (INTEGER) - Number of correct answers
- `total_questions` (INTEGER) - Total number of questions in the quiz
- `completed_at` (TIMESTAMPTZ) - When quiz was completed
- `created_at` (TIMESTAMPTZ) - Record creation timestamp

**Constraints:**
- `CHECK(score >= 0)` - Non-negative score
- `CHECK(total_questions > 0)` - Must have questions

**Indexes:**
- `idx_quiz_attempts_quiz_id` - Fast lookup by quiz
- `idx_quiz_attempts_user_id` - Fast lookup by user
- `idx_quiz_attempts_quiz_user` - Combined lookup
- `idx_quiz_attempts_completed_at` - Sort by completion time

### Column: `documents.quizzes_generated`

**Type:** `BOOLEAN`  
**Default:** `false`  
**Purpose:** Indicates if quizzes have been generated for this document. Controls enable/disable of `show_quizzes` toggle in admin UI.

## Question Scaling Logic

Questions are automatically scaled based on document size:

**Formula:** `Math.min(Math.max(Math.floor(chunkCount / 2), 10), 100)`

- **Base calculation:** 1 question per 2 chunks
- **Minimum:** 10 questions (even for very small documents)
- **Maximum:** 100 questions (cap for large documents)

**Examples:**
- 20 chunks → 10 questions (minimum)
- 50 chunks → 25 questions
- 100 chunks → 50 questions
- 200+ chunks → 100 questions (maximum)

## Regeneration Limit

Quizzes can be regenerated once per week (7 days) to prevent excessive API usage and costs.

**Exception:** Super admins bypass the regeneration limit and can regenerate quizzes at any time.

**Implementation:**
- Checks `quizzes.generated_at` timestamp
- If less than 7 days since generation, returns error with next allowed date
- Frontend displays countdown timer or disabled button with tooltip

## API Endpoints

### POST `/api/quiz/generate-and-store`

Generates quiz questions and stores them in the database.

**Request:**
```json
{
  "documentSlug": "example-document",
  "numQuestions": 25  // Optional, auto-calculated if not provided
}
```

**Response (Success):**
```json
{
  "success": true,
  "quizId": "uuid-here",
  "documentSlug": "example-document",
  "numQuestions": 25,
  "generatedAt": "2025-01-XXT...",
  "message": "Quiz generated and stored successfully"
}
```

**Response (Regeneration Limit):**
```json
{
  "error": "Regeneration limit exceeded",
  "message": "Quizzes can only be regenerated once per week...",
  "lastGenerated": "2025-01-XXT...",
  "nextAllowedDate": "2025-01-XXT..."
}
```

**Authentication:** Required (must be authenticated user with document access)

### GET `/api/quiz/:documentSlug`

Retrieves stored quiz questions for a document.

**Response:**
```json
{
  "quizId": "uuid-here",
  "questions": [
    {
      "question": "What is...?",
      "options": ["Option A", "Option B", "Option C", "Option D", "Option E"],
      "correctAnswer": 1
    }
  ],
  "documentSlug": "example-document",
  "documentTitle": "Example Document",
  "numQuestions": 25,
  "generatedAt": "2025-01-XXT..."
}
```

**Authentication:** Optional (allows anonymous access if document is public)

### POST `/api/quiz/attempt`

Records a quiz attempt with score.

**Request:**
```json
{
  "quizId": "uuid-here",
  "score": 20
}
```

**Response:**
```json
{
  "success": true,
  "attemptId": "uuid-here",
  "score": 20,
  "totalQuestions": 25,
  "completedAt": "2025-01-XXT..."
}
```

**Authentication:** Optional (allows anonymous attempts)

## Frontend Implementation

### Document Editor Modal

**Location:** `app-src/src/components/Admin/DocumentEditorModal/DocumentUIConfigCard.tsx`

**Features:**
- "Generate Quizzes" button (or "Regenerate Quizzes" if already generated)
- Disabled state when generation is in progress
- Success/error messages with regeneration limit information
- `show_quizzes` toggle disabled until quizzes are generated
- Super admin note about bypassing regeneration limit

**UI Flow:**
1. Admin clicks "Generate Quizzes"
2. Button shows loading state
3. On success: Success message appears, `show_quizzes` toggle becomes enabled
4. On error: Error message with details (including regeneration limit if applicable)

### Quiz Hook

**Location:** `app-src/src/hooks/useQuiz.ts`

**Changes:**
- Removed on-demand generation
- Now loads stored quizzes from API
- Returns `quizId` for attempt submission
- Provides `loadQuiz()` function to reload quizzes

### Quiz Modal

**Location:** `app-src/src/components/Chat/QuizModal.tsx`

**Features:**
- Displays quiz questions one at a time
- Shows correct/incorrect feedback after answering
- Progress indicator showing answered questions
- Score calculation and display on completion
- Automatic attempt submission when quiz is completed
- "Retake Quiz" button for unlimited attempts
- Score display with encouraging messages based on performance

**Score Messages:**
- Perfect score (100%): "Perfect score! 🎉"
- 80%+: "Great job! 👍"
- 60%+: "Good effort! 💪"
- Below 60%: "Keep practicing! 📚"

## Processing Logging

Quiz generation is logged using the same system as document processing.

**Log File:** `logs/document-processing.log`

**Stage:** `quiz`

**Log Entries:**
- `[quiz:started]` - Quiz generation started
- `[quiz:progress]` - Progress updates (calculation, chunk fetching, generation, storage)
- `[quiz:completed]` - Quiz generation completed successfully
- `[quiz:failed]` - Quiz generation failed
- `[error:failed]` - Error details

**Example Log Entry:**
```
[2025-01-XXT...] [document-slug] [quiz:started] Starting quiz generation | {"documentSlug":"example","userId":"..."}
[2025-01-XXT...] [document-slug] [quiz:progress] Calculated 25 questions from 50 chunks | {"chunkCount":50,"questionCount":25}
[2025-01-XXT...] [document-slug] [quiz:progress] Generated 25 questions successfully | {"questionsGenerated":25,"quizId":"..."}
[2025-01-XXT...] [document-slug] [quiz:completed] Quiz generation completed successfully | {"quizId":"...","questionCount":25,"processingTimeMs":45000}
```

## Row Level Security (RLS)

### `quizzes` Table

- **Read:** Authenticated and anonymous users can read quizzes
- **Write:** Service role only (for backend generation)

### `quiz_questions` Table

- **Read:** Authenticated and anonymous users can read quiz questions
- **Write:** Service role only (for backend generation)

### `quiz_attempts` Table

- **Read:** Users can read their own attempts, service role can read all
- **Write:** Authenticated and anonymous users can create attempts (unlimited)
- **Manage:** Service role can manage all attempts

## Usage Workflow

### For Administrators

1. **Generate Quizzes:**
   - Navigate to Document Editor → UI Configuration tab
   - Click "Generate Quizzes" button
   - Wait for generation to complete (typically 30-60 seconds)
   - Success message appears, `show_quizzes` toggle becomes enabled

2. **Enable Quiz Button:**
   - After quizzes are generated, toggle "Show Quiz Button" to ON
   - Quiz button will appear next to keywords in chat interface

3. **Regenerate Quizzes:**
   - Click "Regenerate Quizzes" button
   - Must wait 7 days since last generation (unless super admin)
   - Super admins can regenerate immediately

### For Users

1. **Take Quiz:**
   - Click "Quiz" button next to keywords (if enabled)
   - Answer questions one at a time
   - See immediate feedback (correct/incorrect)
   - Complete all questions to see final score

2. **Retake Quiz:**
   - After completing, click "Retake Quiz" button
   - Unlimited attempts allowed
   - Each attempt is recorded with score

## Technical Details

### Question Generation

- **Model:** GPT-4o-mini (configurable via `config.ai.abstractModel`)
- **Temperature:** 0.7 (balanced creativity/accuracy)
- **Max Tokens:** `2000 + (numQuestions * 300)` (scales with question count)
- **Timeout:** Dynamic based on question count and chunks (max 5 minutes)
- **Retry Strategy:** Uses configured retry logic with exponential backoff

### Chunk Selection

- Fetches random chunks: `Math.max(questionCount * 2, 10)`
- Ensures enough context for good question generation
- Randomization provides variety across generations

### Performance Considerations

- **Generation Time:** 30-60 seconds typical for 25 questions
- **Database Storage:** Efficient with JSONB for options
- **API Costs:** ~$0.01-0.05 per quiz generation (depends on document size)
- **Storage:** Minimal - questions stored as JSONB, very efficient

## Migration

**File:** `migrations/add_quiz_tables.sql`

**Applied:** Yes (via Supabase MCP)

**Includes:**
- Table creation with constraints
- Indexes for performance
- RLS policies
- `quizzes_generated` column addition
- Trigger for `updated_at` timestamp

## Future Enhancements

Potential improvements:

1. **Question Pool:** Generate larger pool, randomly select subset per attempt
2. **Difficulty Levels:** Easy/Medium/Hard questions
3. **Question Types:** Multiple choice, true/false, fill-in-the-blank
4. **Analytics Dashboard:** View quiz performance metrics
5. **Question Review:** Allow admins to review/edit questions before enabling
6. **Export Results:** Download quiz attempt data as CSV
7. **Time Limits:** Add optional time limit per quiz
8. **Question Explanations:** Add explanations for correct answers
9. **Adaptive Quizzing:** Focus on areas user got wrong
10. **Leaderboards:** Show top scores (optional, per document)

## Troubleshooting

### Quizzes Not Generating

1. **Check OpenAI API Key:**
   - Verify `OPENAI_API_KEY` is set in environment
   - Check server logs for API errors

2. **Check Document Chunks:**
   - Ensure document has been processed and has chunks
   - Verify `document_chunks` table has data for document

3. **Check Logs:**
   - Review `logs/document-processing.log` for quiz generation entries
   - Look for error messages in `[quiz:failed]` entries

### Quiz Button Not Appearing

1. **Check `quizzes_generated` Flag:**
   ```sql
   SELECT slug, quizzes_generated FROM documents WHERE slug = 'your-slug';
   ```
   Should be `true` after generation

2. **Check `show_quizzes` Toggle:**
   ```sql
   SELECT slug, show_quizzes FROM documents WHERE slug = 'your-slug';
   ```
   Should be `true` to show button

3. **Check Frontend:**
   - Verify document config is loaded correctly
   - Check browser console for errors

### Regeneration Limit Issues

1. **For Super Admins:**
   - Verify user has `super_admin` role in `user_roles` table
   - Check backend logs for "Super admin detected" message

2. **For Regular Users:**
   - Check `quizzes.generated_at` timestamp
   - Calculate: `generated_at + 7 days` = next allowed date

### Score Not Saving

1. **Check Authentication:**
   - Anonymous attempts are allowed but may fail silently
   - Authenticated users should see errors in console

2. **Check Quiz ID:**
   - Verify quiz exists and is in 'completed' status
   - Check `quizzes` table for quiz record

## Related Documentation

- [Document Processing Logs](./ENHANCED-LOGGING.md)
- [Database Schema](../database/)
- [API Documentation](../api-docs/)
- [Admin UI Guide](../ui-ux/)

## Files Modified

**Backend:**
- `lib/routes/quiz.js` - API endpoints
- `lib/db/quiz-operations.js` - Database operations (new)
- `lib/processors/quiz-generator.js` - Question generation logic
- `lib/processing-logger.js` - Added QUIZ stage
- `migrations/add_quiz_tables.sql` - Database migration (new)

**Frontend:**
- `app-src/src/components/Admin/DocumentEditorModal/DocumentUIConfigCard.tsx` - Generation UI
- `app-src/src/components/Admin/DocumentEditorModal/index.tsx` - Modal integration
- `app-src/src/components/Admin/DocumentEditorModal/types.ts` - Type definitions
- `app-src/src/components/Chat/QuizModal.tsx` - Quiz display and scoring
- `app-src/src/hooks/useQuiz.ts` - Quiz state management
- `app-src/src/services/quizApi.ts` - API service functions
- `app-src/src/types/admin.ts` - Type definitions
- `app-src/src/lib/supabase/admin.ts` - Admin queries
- `app-src/src/pages/ChatPage.tsx` - Quiz integration
- `app-src/src/pages/SharedConversationPage.tsx` - Quiz integration

## Testing Checklist

- [ ] Generate quizzes for a document
- [ ] Verify questions are stored in database
- [ ] Enable `show_quizzes` toggle
- [ ] Take quiz as user
- [ ] Verify score is calculated correctly
- [ ] Verify attempt is saved
- [ ] Retake quiz multiple times
- [ ] Test regeneration limit (7 days)
- [ ] Test super admin bypass
- [ ] Check processing logs for quiz entries
- [ ] Test with documents of various sizes (small, medium, large)
- [ ] Verify question scaling (1 per 2 chunks, min 10, max 100)

## Support

For issues or questions:
1. Check `logs/document-processing.log` for quiz generation entries
2. Verify database schema matches migration
3. Test with simple document first
4. Review browser console for frontend errors
5. Check Supabase logs for RLS policy issues

