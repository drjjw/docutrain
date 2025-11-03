# Passcode Modal Fix

**Date:** November 3, 2025  
**Issue:** Passcode modal not appearing when accessing passcode-protected documents  
**Status:** ✅ Fixed

## Problem

The passcode modal was failing to appear when users tried to access passcode-protected documents. The API correctly returned a 403 error with `error_type: 'passcode_required'`, but the modal never showed up.

### Root Cause

The issue was in the request deduplication logic in `useDocumentConfig.ts`. When multiple components called `useDocumentConfig` simultaneously:

1. The first request would make the API call and receive the passcode error
2. It would set the error state correctly
3. However, subsequent renders that reused the deduplicated request would clear the error state

The problem was in lines 164-170 of the old code:

```typescript
existingRequest.then((result) => {
  if (!cancelled && result) {  // ❌ When result is null (error case), this doesn't run
    setConfig(result);
    setLoading(false);
    setError(null);            // ❌ Clears error
    setErrorDetails(null);     // ❌ Clears error details
  }
})
```

When the API returned 403 passcode_required, `result` was `null`, so the condition `!cancelled && result` was false. This meant error details were never propagated to components reusing the deduplicated request.

## Solution

Modified the request deduplication mechanism to store and share both success and error states across all components using the same deduplicated request.

### Changes Made

#### 1. Added RequestResult Type (lines 19-24)

```typescript
type RequestResult = {
  config: DocumentConfig | null;
  errorDetails: DocumentConfigError | null;
  error: string | null;
};
```

#### 2. Updated Request Map Type (line 27)

```typescript
const pendingRequests = new Map<string, Promise<RequestResult>>();
```

#### 3. Updated Request Reuse Logic (lines 171-182)

```typescript
existingRequest.then((result) => {
  if (!cancelled) {  // ✅ Removed the `&& result` condition
    devLog(`[useDocumentConfig] Setting state from reused request:`, {
      hasConfig: !!result.config,
      hasError: !!result.error,
      errorType: result.errorDetails?.type
    });
    setConfig(result.config);        // ✅ Sets config (may be null)
    setErrorDetails(result.errorDetails);  // ✅ Sets error details
    setError(result.error);          // ✅ Sets error
    setLoading(false);
  }
})
```

#### 4. Updated loadConfig Return Type (line 189)

Changed from `Promise<DocumentConfig | null>` to `Promise<RequestResult>`

#### 5. Updated All Return Statements

Every return statement in `loadConfig` now returns a `RequestResult` object:

- **Passcode required error (line 277-281):**
  ```typescript
  return {
    config: null,
    errorDetails: errorDetailsValue,
    error: errorMsg
  };
  ```

- **Access denied error (line 315-319):**
  ```typescript
  return {
    config: null,
    errorDetails: errorDetailsValue,
    error: errorMessage
  };
  ```

- **Document not found error (line 337-341):**
  ```typescript
  return {
    config: null,
    errorDetails: errorDetailsValue,
    error: errorMessage
  };
  ```

- **Success case (line 389-393):**
  ```typescript
  return {
    config: doc,
    errorDetails: null,
    error: null
  };
  ```

- **Unexpected error (line 434-438):**
  ```typescript
  return {
    config: null,
    errorDetails: errorDetailsValue,
    error: errorMsg
  };
  ```

- **All other cases:** Return `{ config: null, errorDetails: null, error: null }`

#### 6. Added Debug Logging (lines 173-177)

Added logging to track error propagation in reused requests for easier debugging.

#### 7. Fixed Z-Index Issue in PasscodeModal

The modal was appearing behind the chat input (which has `z-[100]`). Updated the modal's z-index from `z-50` to `z-[9999]` to ensure it appears above all other UI elements:

**File:** `app-src/src/components/Chat/PasscodeModal.tsx` (line 99)

```typescript
// Before:
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">

// After:
<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
```

This matches the z-index used by other modals in the application (Modal.tsx, DocumentOwnerModal.tsx, DocumentSelector in modal mode).

#### 8. Improved 403 Error Handling in Multiple Components

Several components were making independent API requests and showing noisy console errors when documents require passcodes. Updated to handle 403 responses gracefully:

**Files updated:**
- `app-src/src/components/Chat/DocumentSelector.tsx` (lines 133-145)
- `app-src/src/components/Auth/DisclaimerModal.tsx` (lines 185-195)

**Changes:**
- Check `response.ok` before parsing JSON
- Handle 403 responses with informative logging instead of errors
- Gracefully skip operations when authentication is required

**Note:** To minimize these errors, components now check for auth errors before making requests. Added `hasAuthError` prop that's passed through the component hierarchy (ChatPage → ChatHeader → CombinedHeaderMenu → DocumentSelector, and ChatPage → useDisclaimer) to prevent unnecessary API calls when authentication is already known to be required.

**Browser Network Errors:** The browser may still show some "Failed to load resource: 403" messages in red on initial page load. These are native browser network logs that cannot be completely eliminated, but are **expected behavior** and significantly reduced with the new error-checking logic. The application handles them gracefully - users see the passcode modal immediately, and no JavaScript errors occur.

## Files Modified

- `app-src/src/hooks/useDocumentConfig.ts` - Request deduplication and error handling
- `app-src/src/components/Chat/PasscodeModal.tsx` - Z-index fix to appear above chat input  
- `app-src/src/components/Chat/DocumentSelector.tsx` - Graceful 403 error handling + hasAuthError prop to skip unnecessary requests
- `app-src/src/components/Auth/DisclaimerModal.tsx` - Graceful 403 error handling + hasAuthError prop to skip unnecessary requests
- `app-src/src/pages/ChatPage.tsx` - Pass hasAuthError through component hierarchy
- `app-src/src/components/Chat/ChatHeader.tsx` - Accept and forward hasAuthError prop
- `app-src/src/components/Chat/CombinedHeaderMenu.tsx` - Accept and forward hasAuthError prop

## Testing

To verify the fix:

1. Navigate to a passcode-protected page (e.g., `/app/fund`)
2. ✅ Passcode modal should appear immediately
3. ✅ Modal should be fully on top of all UI elements (chat input, header, etc.)
4. ✅ Console logs should show error details being set for all components
5. ✅ Enter correct passcode and page should load successfully

## Impact

This fix ensures that:
- ✅ Passcode modals appear correctly on first load
- ✅ Modals are properly layered above all other UI elements (z-index hierarchy)
- ✅ Error states are properly shared across all components using the same request
- ✅ No race conditions between multiple components calling `useDocumentConfig`
- ✅ Better debugging with enhanced logging for reused requests

## Related Files

- `app-src/src/hooks/useModalState.ts` - Determines which modal to show based on error type
- `app-src/src/pages/ChatPage.tsx` - Main page that uses `useDocumentConfig` and `useModalState`
- `app-src/src/components/Chat/PasscodeModal.tsx` - The modal component that was failing to appear

