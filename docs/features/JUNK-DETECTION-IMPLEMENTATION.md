# Junk Detection & Ban Reason Implementation

## Overview
Integrated junk detection with the existing profanity filter system. Questions are now automatically checked for both profanity and junk content, with ban reasons tracked in the database.

## Changes Made

### 1. Database Schema
- **Added `ban_reason` column** to `chat_conversations` table
  - Type: `TEXT`, nullable
  - Values: `'profanity'`, `'junk'`, or `NULL` (when not banned)
  - Constraint: Must be set when `banned=true`, must be NULL when `banned=false`
  - Indexed for efficient queries

### 2. Junk Detection Logic (`lib/utils/profanity-filter.js`)
Added comprehensive junk detection that flags:
- **Too short**: Less than 3 characters (except 2-letter acronyms like "DM", "CKD")
- **Only whitespace**: Empty or whitespace-only strings
- **Only special characters**: Strings with mostly special characters
- **Only numbers**: Strings with mostly numbers (< 30% letters)
- **Repeated characters**: More than 50% of characters are the same (e.g., "aaaaaa", "111111")
- **Keyboard patterns**: Common keyboard sequences (e.g., "qwerty", "asdfgh", "zxcvbn")
- **Alternating patterns**: Repetitive patterns (e.g., "ababab", "121212")
- **Single character repetition**: All characters are the same (e.g., "aaaa", "????")

### 3. Content Check Function
New `checkContent()` function that:
- Checks profanity first (higher priority)
- Then checks for junk
- Returns `{ shouldBan: boolean, reason: 'profanity' | 'junk' | null }`

### 4. Updated Profanity Check Endpoint (`lib/routes/profanity.js`)
- Now uses `checkContent()` instead of just `containsProfanity()`
- Updates both `banned` and `ban_reason` columns when content is flagged
- Returns ban reason in API response

### 5. Database Trigger
The existing trigger (`profanity_check_trigger`) automatically calls `/api/profanity-check` for new conversations, which now checks both profanity and junk.

## Files Modified
- `lib/utils/profanity-filter.js` - Added junk detection functions
- `lib/routes/profanity.js` - Updated to use combined content check
- `migrations/add_ban_reason_column.sql` - Database migration

## Files Created
- `scripts/test-junk-detection.js` - Test script for junk detection

## Testing
Run the test script to verify junk detection:
```bash
node scripts/test-junk-detection.js
```

All 22 test cases pass, covering:
- Junk detection (short, garbled, patterns)
- Valid content (questions, acronyms, greetings)

## Database Migration Status
✅ Migration applied successfully to production database
- Column added
- Constraint created
- Index created
- Existing banned conversations updated with default reason 'profanity'

## Things to Check After RLS Changes

Since we added a new column (`ban_reason`) to `chat_conversations`, you should verify:

1. **RLS Policies**: Ensure RLS policies on `chat_conversations` still work correctly with the new column
   - Check if any policies filter by `banned` column - they should still work
   - Verify service role can update `ban_reason` (needed for profanity check endpoint)

2. **API Endpoints**: Verify these endpoints handle `ban_reason` correctly:
   - `/api/profanity-check` - ✅ Updated to set ban_reason
   - `/api/documents/:documentId/recent-questions` - Should filter out banned questions (already does)
   - Any admin endpoints that display banned conversations

3. **Frontend Components**: Check if any components display banned conversations:
   - `RecentQuestions` component - ✅ Already filters out banned
   - Admin dashboards - May need to show ban_reason for debugging

4. **Realtime Subscriptions**: Verify realtime subscriptions still work:
   - `RecentQuestions` component subscribes to new conversations - ✅ Already filters banned

5. **Analytics/Reporting**: If you have analytics queries:
   - Queries filtering by `banned` should still work
   - New queries can filter by `ban_reason` to see breakdown of profanity vs junk

## Example Queries

Check banned conversations by reason:
```sql
SELECT ban_reason, COUNT(*) 
FROM chat_conversations 
WHERE banned = true 
GROUP BY ban_reason;
```

Find junk questions:
```sql
SELECT id, question, ban_reason, created_at
FROM chat_conversations
WHERE banned = true AND ban_reason = 'junk'
ORDER BY created_at DESC
LIMIT 20;
```

## Notes
- The constraint ensures data integrity: banned conversations must have a reason
- Existing banned conversations were updated with default reason 'profanity'
- 2-letter strings are allowed (could be acronyms like "DM", "CKD")
- Profanity check takes priority over junk detection (if both detected, reason = 'profanity')



