# Supabase Authentication Integration Guide

## Overview

This document describes the Supabase authentication integration that has been added to your PDF chatbot application. The implementation allows users to sign up, sign in, and have their conversations associated with their user accounts, while still supporting anonymous usage.

## Features

✅ **User Registration** - Email/password signup with validation  
✅ **User Sign In** - Secure authentication with JWT tokens  
✅ **Session Management** - Persistent sessions across page reloads  
✅ **User Profile** - Display user email with dropdown menu  
✅ **Optional Authentication** - Anonymous users can still use the chatbot  
✅ **Conversation Tracking** - Associate conversations with authenticated users  
✅ **Modern UI** - Beautiful modal-based authentication forms  

## Architecture

### Backend Components

#### 1. Authentication Middleware (`lib/auth-middleware.js`)

Two middleware functions for Express routes:

- **`requireAuth`** - Requires valid JWT token, returns 401 if not authenticated
- **`optionalAuth`** - Adds user to request if authenticated, but doesn't block anonymous users

```javascript
const { requireAuth, optionalAuth } = require('./lib/auth-middleware');

// Protected endpoint
app.get('/api/protected', requireAuth, (req, res) => {
  // req.user is available
});

// Optional auth endpoint
app.post('/api/chat', optionalAuth, (req, res) => {
  // req.user is available if authenticated, null otherwise
});
```

#### 2. Authentication API Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/auth/signup` | POST | No | Create new user account |
| `/api/auth/signin` | POST | No | Sign in with email/password |
| `/api/auth/signout` | POST | Yes | Sign out (client-side primarily) |
| `/api/auth/session` | GET | Yes | Get current user session |
| `/api/auth/refresh` | POST | No | Refresh access token |
| `/api/config/supabase` | GET | No | Get Supabase config for frontend |

#### 3. Updated Chat Endpoint

The `/api/chat` endpoint now uses `optionalAuth` middleware:
- If user is authenticated, `user_id` is logged with the conversation
- If user is anonymous, `user_id` is `null`
- Chat functionality works the same in both cases

### Frontend Components

#### 1. Authentication State Management (`public/js/auth.js`)

Core authentication functions:

```javascript
import { 
  signUp, 
  signIn, 
  signOut, 
  isAuthenticated, 
  getCurrentUser,
  getAuthToken,
  onAuthStateChange,
  restoreSession 
} from './auth.js';

// Sign up a new user
const result = await signUp('user@example.com', 'password123');

// Sign in
const result = await signIn('user@example.com', 'password123');

// Sign out
await signOut();

// Check if authenticated
if (isAuthenticated()) {
  const user = getCurrentUser();
  console.log('User:', user.email);
}

// Listen to auth state changes
const unsubscribe = onAuthStateChange((user) => {
  if (user) {
    console.log('Signed in:', user.email);
  } else {
    console.log('Signed out');
  }
});
```

#### 2. Authentication UI (`public/index.html` + `public/css/auth.css`)

- **Modal Dialog** - Beautiful centered modal for sign in/sign up
- **Form Validation** - Client-side validation with error messages
- **User Profile Dropdown** - Shows user email with sign out option
- **Responsive Design** - Works on mobile and desktop

#### 3. Updated API Client (`public/js/api.js`)

Automatically includes JWT token in API requests when user is authenticated:

```javascript
// Authorization header is automatically added if user is signed in
const response = await sendMessageToAPI(message, history, model, sessionId, doc);
```

## Database Schema

### Required Migration

Run the SQL migration to add user tracking:

```bash
# Using Supabase CLI
supabase db reset --db-url "postgresql://..."

# Or run the SQL directly
psql -h ... -U postgres -d postgres -f scripts/add-user-auth-migration.sql
```

### Schema Changes

```sql
ALTER TABLE chat_conversations 
ADD COLUMN user_id UUID REFERENCES auth.users(id);

CREATE INDEX idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX idx_chat_conversations_user_session ON chat_conversations(user_id, session_id);
```

## User Interface

### Authentication Modal

**Sign In Form:**
- Email input
- Password input
- Sign in button
- Link to switch to sign up

**Sign Up Form:**
- Email input
- Password input (min 6 characters)
- Confirm password input
- Sign up button
- Link to switch to sign in

### Header Authentication Elements

**Before Sign In:**
- "Sign In" button in top-right corner

**After Sign In:**
- User avatar (first letter of email)
- User email (hidden on mobile)
- Dropdown with "Sign Out" option

## Security Considerations

### Token Storage
- JWT access tokens stored in `localStorage`
- Tokens automatically included in API requests
- Tokens validated on server with each request

### Password Requirements
- Minimum 6 characters (enforced by Supabase)
- Additional validation can be added in signup form

### Session Management
- Sessions persist across page reloads
- Token expiration handled by Supabase
- Invalid tokens automatically cleared

### RLS (Row Level Security)

**Current State:** RLS is not enabled by default to maintain backward compatibility.

**To Enable RLS (Optional):**

See `DATABASE_MIGRATION_NOTES.md` for detailed RLS policies. Consider:
- Whether users should see their own conversation history
- Whether anonymous conversations should remain accessible
- Admin access requirements
- Privacy/GDPR compliance

## Testing the Integration

### Manual Testing Checklist

1. **Sign Up Flow**
   - [ ] Click "Sign In" button
   - [ ] Switch to "Sign Up"
   - [ ] Enter email and password
   - [ ] Password confirmation works
   - [ ] Account created successfully
   - [ ] User automatically signed in

2. **Sign In Flow**
   - [ ] Enter valid credentials
   - [ ] User signed in successfully
   - [ ] User profile appears in header
   - [ ] Email displayed correctly

3. **Session Persistence**
   - [ ] Refresh page
   - [ ] User still signed in
   - [ ] User profile still visible

4. **Chat with Authentication**
   - [ ] Send message while signed in
   - [ ] Verify conversation logged with user_id
   - [ ] Check database: `SELECT user_id FROM chat_conversations ORDER BY created_at DESC LIMIT 5;`

5. **Anonymous Chat**
   - [ ] Sign out
   - [ ] Send message
   - [ ] Verify conversation logged with user_id = NULL

6. **Sign Out Flow**
   - [ ] Click user profile dropdown
   - [ ] Click "Sign Out"
   - [ ] User signed out successfully
   - [ ] "Sign In" button reappears

### Database Verification

```sql
-- Check if user_id column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_conversations' 
  AND column_name = 'user_id';

-- View recent authenticated conversations
SELECT 
  id, 
  user_id, 
  session_id,
  question,
  created_at
FROM chat_conversations 
WHERE user_id IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;

-- Count conversations by auth status
SELECT 
  CASE WHEN user_id IS NULL THEN 'Anonymous' ELSE 'Authenticated' END as auth_status,
  COUNT(*) as count
FROM chat_conversations 
GROUP BY auth_status;
```

## Customization Options

### Change Authentication Requirements

**Make Authentication Required:**

```javascript
// In public/js/chat.js, add check before sending message
import { isAuthenticated, showAuthModal } from './auth.js';

export async function sendMessage(state, elements) {
    // Require authentication
    if (!isAuthenticated()) {
        showAuthModal('signin');
        return;
    }
    
    // ... rest of sendMessage code
}
```

**Add Social Login (Google, GitHub, etc.):**

See Supabase documentation for adding OAuth providers:
https://supabase.com/docs/guides/auth/social-login

### Customize UI Styles

Edit `public/css/auth.css` to change colors, spacing, animations:

```css
/* Change primary color */
:root {
  --auth-primary: #cc0000;
  --auth-primary-hover: #aa0000;
}
```

### Add User Profile Page

Create a new page to show user's conversation history:

```javascript
// Get user's conversations
const { data, error } = await supabase
  .from('chat_conversations')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });
```

## Troubleshooting

### "Invalid or expired token" errors

**Cause:** Token expired or invalid  
**Solution:** Sign out and sign in again

### Sessions not persisting

**Cause:** localStorage blocked or cleared  
**Solution:** Check browser privacy settings, ensure localStorage is enabled

### RLS blocking queries

**Cause:** Row Level Security policies too restrictive  
**Solution:** Review policies in DATABASE_MIGRATION_NOTES.md, ensure service role key used for admin queries

### CORS errors with authentication

**Cause:** Authorization header blocked by CORS  
**Solution:** Already configured in server.js with `credentials: true`

## Future Enhancements

Consider adding:
- [ ] Email verification requirement
- [ ] Password reset flow
- [ ] User profile editing
- [ ] Conversation history page
- [ ] Social login (Google, GitHub)
- [ ] Two-factor authentication
- [ ] Remember me option
- [ ] Account deletion
- [ ] Export conversation data

## Questions to Consider

Before deploying to production, consider:

1. **Do you want to require authentication?**
   - Current: Optional (anonymous allowed)
   - Option: Make it required for all users

2. **Should users see their conversation history?**
   - Requires: User profile page + RLS policies
   - Privacy: Consider GDPR implications

3. **Email verification?**
   - Supabase supports email confirmation
   - Adds extra step but improves security

4. **Rate limiting?**
   - Consider per-user rate limits
   - Prevent abuse of anonymous access

## Support

For issues or questions:
- Check Supabase Auth docs: https://supabase.com/docs/guides/auth
- Review error logs in browser console and server logs
- Test with Supabase dashboard: Auth section
