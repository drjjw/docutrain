# Database Migration Notes for Authentication Integration

## Required Database Changes

### 1. Add user_id column to chat_conversations table

To associate conversations with authenticated users, you need to add a `user_id` column to the `chat_conversations` table:

```sql
-- Add user_id column to chat_conversations table
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id 
ON chat_conversations(user_id);

-- Add index for user + session queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_session 
ON chat_conversations(user_id, session_id);
```

### 2. Enable Row Level Security (RLS) for user data (Optional but Recommended)

If you want users to only see their own conversations:

```sql
-- Enable RLS on chat_conversations table
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own conversations
CREATE POLICY "Users can view own conversations" 
ON chat_conversations FOR SELECT 
USING (
  user_id = auth.uid() OR user_id IS NULL  -- Allow viewing anonymous conversations too
);

-- Allow anonymous conversations (user_id = NULL)
CREATE POLICY "Allow anonymous conversations" 
ON chat_conversations FOR INSERT 
WITH CHECK (true);  -- Anyone can create conversations

-- Allow authenticated users to create conversations
CREATE POLICY "Authenticated users can create conversations" 
ON chat_conversations FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
```

### 3. Verification

After running the migration, verify:

```sql
-- Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_conversations' AND column_name = 'user_id';

-- Check if indexes exist
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'chat_conversations' 
AND indexname LIKE '%user_id%';

-- Check RLS policies (if enabled)
SELECT * FROM pg_policies WHERE tablename = 'chat_conversations';
```

## Important Notes

### RLS Considerations

When implementing RLS on the `chat_conversations` table:

1. **Anonymous Access**: The current implementation allows both authenticated and anonymous users. If you enable RLS, make sure:
   - Anonymous conversations (user_id IS NULL) remain accessible
   - Service role queries (from your backend) can still insert/update all records

2. **Admin Access**: You may want to add an admin policy:
   ```sql
   CREATE POLICY "Admins can view all conversations" 
   ON chat_conversations FOR ALL 
   USING (
     auth.jwt() ->> 'role' = 'admin'
   );
   ```

3. **Analytics Queries**: Ensure your analytics endpoint uses the service role key, not the anon key, if you want to see all conversations:
   ```javascript
   // In server.js, the supabase client already uses service role via SUPABASE_ANON_KEY
   // But for admin queries, you might want to use SUPABASE_SERVICE_ROLE_KEY
   ```

### Backward Compatibility

The implementation maintains backward compatibility:
- Existing conversations will have `user_id = NULL` (anonymous)
- Anonymous users can still use the chatbot
- Only authenticated users will have their user_id logged

### Privacy Considerations

Before enabling strict RLS:
1. Decide if you want users to see their conversation history
2. Consider GDPR/privacy implications of storing user conversations
3. Implement conversation deletion if required
4. Consider adding a user settings page for privacy controls

## Testing Checklist

After migration, test:
- [ ] Anonymous users can still chat (user_id should be NULL)
- [ ] Authenticated users can chat (user_id should be populated)
- [ ] Existing conversations still accessible
- [ ] Analytics queries still work
- [ ] RLS policies don't block legitimate access (if enabled)
