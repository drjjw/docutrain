# Disclaimer Feature - React Implementation

**Date**: November 3, 2025  
**Status**: ✅ Complete

## Problem

The disclaimer feature that existed in the deprecated vanilla JS chat app was not implemented in the React chat app. This disclaimer is critical for medical/educational documents (specifically documents with `owner === 'ukidney'`) to ensure users acknowledge the educational-use-only nature of the content.

### Original Vanilla JS Implementation

In the deprecated app (`deprecated/public/js/disclaimer.js`):
- Checked if any selected document had `owner === 'ukidney'`
- Showed a SweetAlert2 modal with disclaimer text
- Used session cookies to remember consent (expires when browser closes)
- Supported iframe detection (skips disclaimer if in iframe)
- Redirected users who declined to home page

## Solution

Implemented a complete disclaimer system in the React app with the following components:

### 1. DisclaimerModal Component

**File**: `app-src/src/components/Auth/DisclaimerModal.tsx`

**Features**:
- Modal component using existing `Modal` and `Button` UI components
- Session cookie management using `js-cookie` library
- Iframe detection (auto-accepts if in iframe context)
- Cookie checking (auto-accepts if cookie exists)
- 500ms delay before showing for better UX
- Cannot be dismissed by clicking outside or pressing ESC

**Cookie Details**:
- Name: `_ukidney_disclaimer_agree`
- Value: `'Yes'` when accepted
- Expiry: Session only (expires when browser closes)
- Path: `/` (site-wide)

### 2. useDisclaimer Hook

**Features**:
- Supports both single and multi-document scenarios
- Parses comma-separated document slugs (e.g., `?doc=doc1,doc2,doc3`)
- Fetches document metadata from `/api/documents` endpoint
- Checks if ANY document has `owner === 'ukidney'`
- Shows disclaimer if at least one document requires it
- Includes JWT token in API request for authenticated users
- Graceful error handling (skips disclaimer on API errors)

**States**:
- `needsDisclaimer`: Whether disclaimer should be shown
- `disclaimerAccepted`: Whether user has accepted
- `isChecking`: Whether API check is in progress

### 3. Integration in ChatPage

**File**: `app-src/src/pages/ChatPage.tsx`

**Changes**:
- Added import for `DisclaimerModal` and `useDisclaimer`
- Added disclaimer check in Section 6.5 (after document loading)
- Renders `DisclaimerModal` in the component tree
- Passes document slug(s) to `useDisclaimer` hook

## Multi-Document Support

The implementation fully supports multi-document scenarios:

```typescript
// Single document
?doc=ajkd-cc-anca-associated-vasculitis

// Multiple documents (comma-separated)
?doc=ajkd-cc-anca-associated-vasculitis,maker-foh,fund

// If ANY document has owner === 'ukidney', disclaimer shows
```

### Example Scenarios

1. **Single ukidney document**: ✅ Disclaimer shows
   - `?doc=ajkd-cc-anca-associated-vasculitis`

2. **Multiple ukidney documents**: ✅ Disclaimer shows
   - `?doc=ajkd-cc-anca-associated-vasculitis,ajkd-cc-approach-to-kidney-biopsy`

3. **Mixed documents (at least one ukidney)**: ✅ Disclaimer shows
   - `?doc=maker-foh,ajkd-cc-anca-associated-vasculitis,fund`

4. **No ukidney documents**: ❌ Disclaimer does NOT show
   - `?doc=maker-foh,fund`

## User Flow

### First Visit to ukidney Document

1. User navigates to a ukidney document (e.g., `?doc=ajkd-cc-anca-associated-vasculitis`)
2. Page loads, `useDisclaimer` hook fetches document metadata
3. Detects `owner === 'ukidney'`
4. After 500ms delay, disclaimer modal appears
5. User must click "I Agree" or "I Decline"

### User Agrees

1. Session cookie is set: `_ukidney_disclaimer_agree=Yes`
2. Modal closes
3. User can interact with the application
4. On subsequent page loads in same session, disclaimer is skipped

### User Declines

1. User is redirected to home page (`/`)
2. No cookie is set
3. If they return to a ukidney document, disclaimer appears again

### Same Session (Browser Still Open)

1. Cookie is detected
2. Disclaimer is automatically accepted (modal doesn't show)
3. User can immediately interact with the application

### New Session (After Closing Browser)

1. Session cookie has expired
2. Disclaimer appears again
3. User must accept again

### Iframe Context

1. Disclaimer detects iframe context (`window.self !== window.top`)
2. Automatically accepts (parent page handles disclaimer)
3. Logs to console: "🖼️ Running in iframe - disclaimer handled by parent"

## Technical Details

### API Endpoint Used

```
GET /api/documents?doc={slug1,slug2,slug3}
Authorization: Bearer {jwt_token}
```

**Response**:
```json
{
  "documents": [
    {
      "slug": "ajkd-cc-anca-associated-vasculitis",
      "title": "ANCA Associated Vasculitis",
      "owner": "ukidney",
      ...
    }
  ]
}
```

### Disclaimer Text

```
Important Disclaimer

This feature is intended for educational use only by healthcare professionals.

Please verify all suggestions before considering use in patient care settings.

If you agree with these terms, please acknowledge below, otherwise you will be redirected.

By using this service, you also agree to our Terms of Service.
[Link to https://www.docutrain.io/terms]
```

**Note**: The disclaimer includes a link to the Terms of Service that opens in a new tab.

### Utility Functions

```typescript
// Clear disclaimer cookie (useful for testing)
clearDisclaimerCookie()

// Check if user has accepted disclaimer
hasAcceptedDisclaimer() // returns boolean
```

## Testing

### Manual Testing

1. **Test with ukidney document**:
   ```
   http://localhost:5173/app/chat?doc=ajkd-cc-anca-associated-vasculitis
   ```
   - ✅ Disclaimer should appear after 500ms
   - ✅ Click "I Agree" - modal closes, cookie is set
   - ✅ Refresh page - disclaimer should NOT appear

2. **Test with non-ukidney document**:
   ```
   http://localhost:5173/app/chat?doc=maker-foh
   ```
   - ✅ Disclaimer should NOT appear

3. **Test with multi-document (mixed)**:
   ```
   http://localhost:5173/app/chat?doc=maker-foh,ajkd-cc-anca-associated-vasculitis
   ```
   - ✅ Disclaimer should appear (at least one ukidney doc)

4. **Test decline**:
   - Open ukidney document
   - Click "I Decline"
   - ✅ Should redirect to home page

5. **Test cookie clearing**:
   - Open browser DevTools → Console
   - Run: `clearDisclaimerCookie()`
   - Refresh page
   - ✅ Disclaimer should appear again

### Browser DevTools Testing

1. **Check cookie**:
   - DevTools → Application/Storage → Cookies
   - Look for `_ukidney_disclaimer_agree`
   - Value should be `Yes` after accepting

2. **Check console logs**:
   - `[useDisclaimer] At least one ukidney document detected, disclaimer required`
   - `✅ User accepted disclaimer (session only)`
   - `✅ Disclaimer already accepted` (on subsequent loads)

## Database Queries

To see which documents require disclaimer:

```sql
-- All ukidney documents
SELECT slug, title, owner 
FROM documents 
WHERE owner = 'ukidney' 
ORDER BY slug;

-- Count by owner
SELECT owner, COUNT(*) as count 
FROM documents 
WHERE owner IS NOT NULL 
GROUP BY owner 
ORDER BY count DESC;
```

**Current ukidney documents** (as of Nov 2025):
- All AJKD Core Curriculum documents (~50+ documents)
- Examples: `ajkd-cc-anca-associated-vasculitis`, `ajkd-cc-approach-to-kidney-biopsy`, etc.

## RLS Considerations

⚠️ **Important**: When making changes to document access or RLS policies, consider:

1. **Disclaimer bypass**: Ensure RLS doesn't prevent fetching document metadata for disclaimer check
2. **API endpoint**: The `/api/documents` endpoint must return `owner` field for disclaimer logic
3. **Authenticated vs anonymous**: Disclaimer should work for both authenticated and anonymous users
4. **Passcode-protected documents**: Disclaimer should show even if document requires passcode

### Current RLS Status

- ✅ Documents table has RLS enabled
- ✅ API endpoint includes JWT token when available
- ✅ Fallback to anonymous access if no token
- ✅ Owner field is included in API response

## Future Enhancements

### Potential Improvements

1. **Configurable disclaimer per owner**:
   - Store disclaimer text in `owners` table
   - Allow different disclaimer messages for different owners
   - Example: `owners.disclaimer_text` column

2. **Persistent cookie option**:
   - Add option for 30-day cookie instead of session-only
   - Useful for frequent users

3. **Analytics**:
   - Track acceptance rate
   - Track decline rate
   - Store in database for reporting

4. **Multiple disclaimer types**:
   - Different disclaimers for different document types
   - Example: Medical vs. Business vs. Educational

5. **Version tracking**:
   - Track disclaimer version in cookie
   - Force re-acceptance when disclaimer text changes

## Files Changed

### New Files
- `app-src/src/components/Auth/DisclaimerModal.tsx` (240 lines)
- `docs/bug-fixes/DISCLAIMER-REACT-IMPLEMENTATION.md` (this file)

### Modified Files
- `app-src/src/pages/ChatPage.tsx`:
  - Added import for `DisclaimerModal` and `useDisclaimer`
  - Added Section 6.5: Disclaimer Management
  - Rendered `DisclaimerModal` in component tree

### Key Features Added
- Link to Terms of Service (https://www.docutrain.io/terms) in disclaimer text
- Opens in new tab with proper security attributes (`target="_blank" rel="noopener noreferrer"`)

## Dependencies

- `js-cookie`: Already installed (used by `DocutrainFooter`)
- `lucide-react`: Already installed (for `AlertTriangle` icon)
- Existing UI components: `Modal`, `Button`

## Comparison with Vanilla JS

| Feature | Vanilla JS | React Implementation |
|---------|-----------|---------------------|
| Disclaimer detection | ✅ | ✅ |
| Session cookie | ✅ | ✅ |
| Iframe detection | ✅ | ✅ |
| Multi-document support | ✅ | ✅ |
| 500ms delay | ✅ | ✅ |
| Redirect on decline | ✅ (`/goodbye`) | ✅ (`/`) |
| SweetAlert2 | ✅ | ❌ (uses Modal component) |
| Animate.css | ✅ | ❌ (CSS transitions) |

### Differences

1. **Modal library**: React version uses custom `Modal` component instead of SweetAlert2
2. **Redirect URL**: React version redirects to `/` instead of `/goodbye`
3. **Styling**: React version uses Tailwind CSS instead of custom CSS

## Conclusion

The disclaimer feature has been fully implemented in the React chat app with:
- ✅ Feature parity with vanilla JS version
- ✅ Multi-document support
- ✅ Clean, maintainable code
- ✅ Proper error handling
- ✅ Comprehensive documentation

The implementation ensures that users viewing medical/educational content from ukidney documents are properly informed about the educational-use-only nature of the content.

