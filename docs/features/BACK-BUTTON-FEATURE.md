# Back Button URL Configuration Feature

## Overview

The back button in the mobile view is now fully configurable via URL parameter, replacing the previous hardcoded "Back to Manual" implementation.

## Feature Details

### URL Parameter: `back-button`

**Syntax:**
```
?back-button=URL
```

**Behavior:**
- **Parameter present:** Back button is displayed in mobile view with the specified URL
- **Parameter absent:** Back button is hidden entirely
- **Works with all document types:** Not tied to any specific document configuration

### Examples

**Show back button to brightbean.io:**
```
https://your-domain.com/chat?doc=smh&back-button=https://brightbean.io
```

**Show back button to a specific manual page:**
```
https://your-domain.com/chat?doc=uhn&back-button=https://brightbean.io/nephrology-publications/nephrology-manuals/uhn-manual
```

**No back button (standalone mode):**
```
https://your-domain.com/chat?doc=smh
```

**⚠️ Important: URL Encoding**

For URLs with special characters (like `?`, `&`, `#`), you **must** encode the back-button value:

```javascript
// ✅ CORRECT: Encode complex URLs
const backURL = 'https://brightbean.io/page?id=123&ref=test';
const chatURL = `?doc=smh&back-button=${encodeURIComponent(backURL)}`;
// Result: ?doc=smh&back-button=https%3A%2F%2Fbrightbean.io%2Fpage%3Fid%3D123%26ref%3Dtest
```

See [BACK-BUTTON-URL-ENCODING.md](BACK-BUTTON-URL-ENCODING.md) for complete encoding guidelines.

## Implementation

### Files Modified

1. **`public/js/config.js`** (and `dist/public/js/config.js`)
   - Added `getBackButtonURL()` function to parse URL parameter
   - Returns `null` if parameter is not present

2. **`public/js/ui.js`** (and `dist/public/js/ui.js`)
   - Imported `getBackButtonURL` from config
   - Updated `updateDocumentUI()` to check for back button URL parameter
   - Shows/hides back button based on parameter presence
   - Sets `href` to the provided URL when shown

3. **`public/index.html`** (and `dist/public/index.html`)
   - Changed default back button to `display: none`
   - Changed default `href` to `#` (placeholder)
   - Button is shown dynamically when parameter is present

### Code Flow

```javascript
// 1. Parse URL parameter
export function getBackButtonURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('back-button') || null;
}

// 2. Update UI based on parameter
const backButtonURL = getBackButtonURL();
if (backButtonURL) {
    backLink.href = backButtonURL;
    backLink.style.display = '';  // Show button
} else {
    backLink.style.display = 'none';  // Hide button
}
```

## Use Cases

### 1. Embedded in Different Contexts
Create different back navigation for different embedding contexts:

```html
<!-- Embedded in manual page -->
<iframe src="chat?doc=smh&back-button=https://brightbean.io/manuals/smh"></iframe>

<!-- Embedded in guidelines page -->
<iframe src="chat?doc=ckd-dc-2025&back-button=https://brightbean.io/guidelines"></iframe>
```

### 2. Standalone Deployment
Remove back button entirely for standalone chatbot:

```html
<!-- No back button shown -->
<iframe src="chat?doc=smh"></iframe>
```

### 3. Custom Navigation Flows
Create custom navigation based on user journey:

```javascript
// From homepage
const chatURL = `chat?doc=smh&back-button=${encodeURIComponent('https://brightbean.io')}`;

// From specific article
const chatURL = `chat?doc=smh&back-button=${encodeURIComponent(document.referrer)}`;
```

## Benefits

1. **Flexibility:** Each deployment can have its own back navigation
2. **No Hardcoding:** No need to modify code for different contexts
3. **Clean UI:** Back button only appears when needed
4. **Multi-tenant Ready:** Different tenants can configure their own back links
5. **Mobile-First:** Back button only visible in mobile view (CSS controlled)

## Migration from Old System

### Before (Hardcoded)
```javascript
// In config.js - hardcoded per document
backLink: 'https://brightbean.io/nephrology-publications/...'

// In ui.js - used document's backLink
backLink.href = config.backLink;
```

### After (URL Parameter)
```javascript
// In config.js - parse from URL
export function getBackButtonURL() {
    return params.get('back-button') || null;
}

// In ui.js - show/hide based on parameter
const backButtonURL = getBackButtonURL();
if (backButtonURL) {
    backLink.href = backButtonURL;
    backLink.style.display = '';
} else {
    backLink.style.display = 'none';
}
```

## Testing

### Test Cases

1. **With back button:**
   ```
   http://localhost:3456?doc=smh&back-button=https://brightbean.io
   ```
   ✓ Back button should be visible in mobile view
   ✓ Clicking should navigate to https://brightbean.io

2. **Without back button:**
   ```
   http://localhost:3456?doc=smh
   ```
   ✓ Back button should be hidden

3. **URL encoding:**
   ```
   http://localhost:3456?doc=smh&back-button=https://example.com/path?param=value
   ```
   ✓ URL should be properly encoded/decoded
   ✓ Navigation should work correctly

4. **Mobile vs Desktop:**
   - Back button should only appear in mobile view (CSS media query)
   - Test on both mobile and desktop viewports

## Related Documentation

- [URL-PARAMETERS.md](URL-PARAMETERS.md) - Complete URL parameter reference
- [DOCUMENT-SELECTOR-FEATURE.md](DOCUMENT-SELECTOR-FEATURE.md) - Document selector feature
- [DEPLOYMENT-REFACTORED-APP.md](DEPLOYMENT-REFACTORED-APP.md) - Deployment guide

## Notes

- The back button text remains "Back to Manual" but this could be made configurable in the future
- The back button is styled via CSS and only appears in mobile view
- The parameter name uses a hyphen (`back-button`) not camelCase for URL convention
- URL encoding is handled automatically by `URLSearchParams`

