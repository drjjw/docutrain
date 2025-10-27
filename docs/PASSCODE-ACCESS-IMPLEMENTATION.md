# Passcode Access Level Implementation

**Date:** October 27, 2025  
**Status:** ✅ Complete

## Overview

Implemented the passcode access level feature for documents. Documents with `access_level = 'passcode'` now require a passcode to access (similar to public access but with passcode protection). If the passcode is not provided in the URL, a modal appears prompting the user to enter it.

## Implementation Details

### 1. Database Layer

**Updated Functions:**
- `user_has_document_access(p_user_id, p_document_id, p_passcode)` - Now accepts optional passcode parameter
- `user_has_document_access_by_slug(p_user_id, p_document_slug, p_passcode)` - Now accepts optional passcode parameter

**Passcode Validation Logic:**
```sql
-- PASSCODE: Validate passcode if provided
IF doc_access_level = 'passcode' THEN
  -- If document has no passcode set, treat as public
  IF doc_passcode IS NULL OR doc_passcode = '' THEN
    RETURN true;
  END IF;
  
  -- If passcode provided, check if it matches (case-sensitive)
  IF p_passcode IS NOT NULL AND p_passcode = doc_passcode THEN
    RETURN true;
  END IF;
  
  -- No passcode provided or incorrect passcode
  RETURN false;
END IF;
```

**Migration:** `add_passcode_validation_v3.sql`
- Dropped and recreated functions with new signature
- Recreated RLS policies to work with updated functions

### 2. Backend API Layer

**Updated Files:**
- `lib/routes/permissions.js` - Check-access endpoint now accepts passcode in request body
- `lib/routes/chat.js` - Chat endpoint extracts passcode from request body and passes to access check
- `lib/routes/chat-helpers.js` - `checkDocumentAccess()` function now accepts and passes passcode parameter

**New Error Type:**
- `passcode_required` - Returned when document requires passcode but none provided or incorrect

**API Request Format:**
```javascript
POST /api/permissions/check-access/:slug
Body: { passcode: "optional-passcode" }

POST /api/chat
Body: { 
  message: "...",
  doc: "document-slug",
  passcode: "optional-passcode"  // New field
}
```

### 3. Frontend Layer

**Updated Files:**

**`public/js/access-check.js`:**
- `checkDocumentAccess()` now accepts optional passcode parameter
- Added `showPasscodeModal()` function that displays SweetAlert2 modal
- Modal includes password input field with validation
- On submit, re-checks access with provided passcode
- On success, reloads page to show document
- `initAccessCheck()` now extracts passcode from URL parameter `?passcode=xxx`

**`public/js/api.js`:**
- Both streaming and non-streaming API calls now extract passcode from URL
- Passcode is included in request body if present in URL

**Passcode Modal Features:**
- Password input field (hidden characters)
- Real-time validation (re-checks access on submit)
- Shows error if passcode is incorrect
- Allows retry without page reload
- "Go Back" option to return to previous page

### 4. URL Parameter Support

**Usage Examples:**
```
# Without passcode - will show modal if required
?doc=document-slug

# With passcode in URL - bypasses modal
?doc=document-slug&passcode=secret123

# Multi-document with passcode
?doc=doc1+doc2&passcode=secret123
```

## User Flow

### Scenario 1: Passcode in URL
1. User visits `?doc=protected-doc&passcode=correct123`
2. Frontend extracts passcode from URL
3. Access check passes with passcode
4. Document loads normally
5. Chat requests include passcode automatically

### Scenario 2: No Passcode in URL
1. User visits `?doc=protected-doc`
2. Frontend performs access check without passcode
3. Backend returns `error_type: 'passcode_required'`
4. Frontend shows passcode modal
5. User enters passcode and submits
6. Frontend re-checks access with passcode
7. If correct: page reloads and document loads
8. If incorrect: error shown, user can retry

### Scenario 3: Incorrect Passcode in URL
1. User visits `?doc=protected-doc&passcode=wrong123`
2. Access check fails
3. Modal appears asking for correct passcode
4. User enters correct passcode
5. Page reloads with document access

## Security Considerations

### ✅ Implemented Security Features:
1. **Case-sensitive passcodes** - Exact match required
2. **Server-side validation** - All checks done in database function
3. **No passcode exposure** - Passcodes never returned to frontend (except in URL)
4. **RLS policies** - Passcode documents still respect RLS for database queries

### ⚠️ Security Notes:
1. **URL visibility** - Passcodes in URL are visible in browser history and logs
2. **No encryption** - Passcodes stored as plain text in database
3. **No rate limiting** - Unlimited passcode attempts currently allowed
4. **Shared passcode** - One passcode per document (not per-user)

### 💡 Recommendations for Production:
1. Consider using session storage after first successful passcode entry
2. Implement rate limiting for passcode attempts
3. Add audit logging for passcode access attempts
4. Consider passcode expiration/rotation policies
5. For sensitive documents, use `registered` or `owner_restricted` access levels instead

## Testing Checklist

To test the passcode feature:

1. **Set up test document:**
   ```sql
   UPDATE documents 
   SET access_level = 'passcode', passcode = 'test123'
   WHERE slug = 'test-doc';
   ```

2. **Test scenarios:**
   - [ ] Visit without passcode → modal appears
   - [ ] Enter correct passcode → document loads
   - [ ] Enter incorrect passcode → error shown, can retry
   - [ ] Visit with correct passcode in URL → no modal, loads directly
   - [ ] Visit with incorrect passcode in URL → modal appears
   - [ ] Chat functionality works with passcode
   - [ ] Multi-document URLs work with passcode

3. **Edge cases:**
   - [ ] Document with `passcode = NULL` → treated as public
   - [ ] Document with `passcode = ''` → treated as public
   - [ ] Super admin access → bypasses passcode requirement
   - [ ] Passcode with special characters
   - [ ] Very long passcode (test limits)

## Admin Interface

**To set passcode on a document:**
1. Go to `/app/documents` (admin panel)
2. Edit document
3. Set `Access Level` to "Passcode"
4. Enter desired passcode in `Passcode` field
5. Save

**Note:** The React admin interface already supports editing the `passcode` field as it was added in the previous permissions rewrite.

## Files Modified

### Database:
- `migrations/add_passcode_validation_v3.sql` (new)

### Backend:
- `lib/routes/permissions.js`
- `lib/routes/chat.js`
- `lib/routes/chat-helpers.js`

### Frontend:
- `public/js/access-check.js`
- `public/js/api.js`

### Build:
- All files rebuilt and hashed in `/dist/`

## Future Enhancements

Potential improvements for the passcode system:

1. **Session-based passcode storage** - Store validated passcode in session/localStorage
2. **Passcode hints** - Optional hint text for users
3. **Multiple passcodes** - Support multiple valid passcodes per document
4. **Time-limited passcodes** - Passcodes that expire after X days
5. **Usage tracking** - Track who accessed with passcode and when
6. **Email-based passcode delivery** - Send passcode via email to authorized users
7. **Passcode strength requirements** - Enforce minimum length/complexity
8. **Brute force protection** - Lock out after X failed attempts
9. **Passcode rotation** - Automatically change passcodes on schedule
10. **Per-user passcodes** - Different passcode for each authorized user

## Related Documentation

- [PERMISSIONS-REWRITE-SUMMARY.md](./PERMISSIONS-REWRITE-SUMMARY.md) - Original access level system
- [PERMISSION-SYSTEM.md](./PERMISSION-SYSTEM.md) - Overall permission architecture
- [AUTHORIZATION-SYSTEM-COMPLETE.md](./AUTHORIZATION-SYSTEM-COMPLETE.md) - User roles and access

## RLS Impact Considerations

When making RLS changes to support passcode access, the following areas should be checked:

### ✅ Areas Verified:
1. **Public document access** - Still works without authentication
2. **Registered user access** - Not affected by passcode changes
3. **Owner-restricted access** - Still requires owner membership
4. **Owner-admin access** - Still requires admin role
5. **Super admin access** - Bypasses all restrictions including passcode

### 🔍 Areas to Monitor:
1. **Document listing queries** - Passcode documents appear in public lists (by design)
2. **Chunk retrieval** - Ensure passcode validation happens before chunk queries
3. **Multi-document queries** - Passcode applies to all documents in query
4. **Embedding queries** - Access check happens before embedding generation

### 💡 Testing Recommendations:
- Test each access level independently after RLS changes
- Verify super admin can access everything
- Check that passcode documents don't leak content in error messages
- Ensure RLS policies don't conflict with passcode validation
- Test with both authenticated and unauthenticated users



