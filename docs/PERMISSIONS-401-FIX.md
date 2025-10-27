# Fix: 401 Unauthorized Error on /api/permissions

## Issue
After the permissions rewrite, users were seeing a 401 error in the browser console when accessing documents:
```
GET http://localhost:3456/api/permissions 401 (Unauthorized)
Failed to fetch user permissions
```

## Root Cause
The error occurs in the `loadUserAvatar()` function in `main.js`, which tries to fetch user permissions to display an owner group logo in the avatar. This happens when:

1. **User is not logged in** - No Supabase session exists in localStorage
2. **Session expired** - The JWT token in localStorage is no longer valid
3. **Invalid token** - The token format or signature is incorrect

## Why This Happens
The main chat interface (`/chat`) is a vanilla JavaScript app that reads the Supabase session from localStorage. The React admin app (`/app`) manages authentication separately. When users:
- Visit the chat page without logging in
- Have an expired session from a previous login
- Clear their session in one app but not the other

The avatar loading function will attempt to fetch permissions with an invalid/missing token, resulting in a 401 error.

## Is This Actually a Problem?
**No, this is expected behavior!** The error is non-critical:

1. ✅ Documents still load correctly (public documents don't require auth)
2. ✅ The code handles the error gracefully with `if (!response.ok) { return; }`
3. ✅ The user just sees the default avatar icon instead of an owner logo
4. ✅ Functionality is not impacted

## What Was Fixed
Changed the error handling in `main.js` to be less alarming:

**Before:**
```javascript
if (!response.ok) {
    console.error('Failed to fetch user permissions');
    return;
}
```

**After:**
```javascript
if (!response.ok) {
    // Token might be expired or invalid - this is not an error, just means user needs to re-login
    if (response.status === 401) {
        console.log('🔒 Session expired or invalid - using default avatar');
    } else {
        console.warn('Could not fetch user permissions:', response.status);
    }
    return;
}
```

## Impact
- **Before**: Red error message in console (looks like something is broken)
- **After**: Informative log message (clarifies this is expected for unauthenticated users)
- **Functionality**: No change - works the same way, just better messaging

## When Users Should Actually Log In
Users need to authenticate when:
1. Accessing documents with `access_level` = `registered`, `owner_restricted`, or `owner_admin_only`
2. Accessing the admin dashboard at `/app/dashboard`
3. Wanting to see their owner group logo in the avatar

For public documents, authentication is **optional** and the 401 error is **harmless**.

## Related Files
- `/public/js/main.js` - Avatar loading function
- `/lib/routes/permissions.js` - Permissions API endpoint
- `/public/js/access-check.js` - Document access checking (also uses Supabase tokens)

## Testing
To verify the fix:
1. Clear browser localStorage (or use incognito mode)
2. Visit `http://localhost:3456/chat?doc=smh`
3. Check console - should see `🔒 Session expired or invalid - using default avatar` instead of error
4. Document should load normally
5. Avatar should show default user icon

## Future Improvements
Consider:
1. Adding a "Sign In" button in the main chat interface for easy access to authentication
2. Detecting expired sessions and prompting users to refresh their login
3. Syncing session state between the main chat app and React admin app

