# Back Button URL Encoding Guide

## Overview

When using the `back-button` URL parameter, proper encoding is important to ensure URLs work correctly, especially when they contain special characters.

## URL Encoding Basics

### Safe Characters in URLs
These characters are safe to use without encoding:
- Letters: `A-Z`, `a-z`
- Numbers: `0-9`
- Safe symbols: `-`, `_`, `.`, `~`
- Path separators: `/` (safe in parameter values)

### Characters That Need Encoding
These characters must be encoded when used in query parameter values:
- `?` → `%3F`
- `&` → `%26`
- `#` → `%23`
- `=` → `%3D`
- `+` → `%2B`
- Space → `%20` or `+`

## Automatic Decoding

Our implementation uses `URLSearchParams`, which **automatically decodes** parameter values:

```javascript
export function getBackButtonURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('back-button') || null;  // ✅ Automatically decodes
}
```

## Creating URLs with Back Button

### ✅ Correct: Using encodeURIComponent()

**JavaScript:**
```javascript
const backURL = 'https://ukidney.com/manuals/smh?ref=chatbot&source=test';
const chatURL = `?doc=smh&back-button=${encodeURIComponent(backURL)}`;
// Result: ?doc=smh&back-button=https%3A%2F%2Fukidney.com%2Fmanuals%2Fsmh%3Fref%3Dchatbot%26source%3Dtest
```

**HTML:**
```html
<a href="?doc=smh&back-button=https%3A%2F%2Fukidney.com%2Fmanuals">Link</a>
```

**Server-side (Node.js):**
```javascript
const backURL = 'https://ukidney.com/manuals/smh';
const chatURL = `?doc=smh&back-button=${encodeURIComponent(backURL)}`;
```

### ⚠️ Works But Not Recommended: Simple URLs

Simple URLs without special characters work without encoding:
```
?doc=smh&back-button=https://ukidney.com/manuals/smh
```

This works because:
- Slashes (`/`) are safe in parameter values
- Colons (`:`) are safe in parameter values
- No ambiguous characters like `?`, `&`, or `#`

### ❌ Incorrect: URLs with Query Parameters

**This will break:**
```
?doc=smh&back-button=https://ukidney.com/page?id=123&ref=test
                                              ↑       ↑
                                    These will be interpreted as 
                                    separate query parameters!
```

The browser will parse this as:
- `doc=smh`
- `back-button=https://ukidney.com/page?id=123` (truncated!)
- `ref=test` (separate parameter)

**Fix with encoding:**
```
?doc=smh&back-button=https%3A%2F%2Fukidney.com%2Fpage%3Fid%3D123%26ref%3Dtest
```

## Real-World Examples

### Example 1: Simple Homepage Link
```javascript
// ✅ Safe without encoding (no special chars)
const url = '?doc=smh&back-button=https://ukidney.com';
```

### Example 2: Path with Slashes
```javascript
// ✅ Safe without encoding (slashes are OK)
const url = '?doc=smh&back-button=https://ukidney.com/manuals/smh';
```

### Example 3: URL with Query Parameters
```javascript
// ⚠️ MUST encode (contains ? and &)
const backURL = 'https://ukidney.com/page?id=123&ref=chatbot';
const url = `?doc=smh&back-button=${encodeURIComponent(backURL)}`;
// Result: ?doc=smh&back-button=https%3A%2F%2Fukidney.com%2Fpage%3Fid%3D123%26ref%3Dchatbot
```

### Example 4: URL with Hash Fragment
```javascript
// ⚠️ MUST encode (contains #)
const backURL = 'https://ukidney.com/page#section';
const url = `?doc=smh&back-button=${encodeURIComponent(backURL)}`;
// Result: ?doc=smh&back-button=https%3A%2F%2Fukidney.com%2Fpage%23section
```

### Example 5: Dynamic Back URL
```javascript
// ✅ Always encode when building dynamically
const referrer = document.referrer || 'https://ukidney.com';
const url = `?doc=smh&back-button=${encodeURIComponent(referrer)}`;
```

## Testing URL Encoding

### Test in Browser Console
```javascript
// Test encoding
const backURL = 'https://ukidney.com/page?id=123&ref=test';
const encoded = encodeURIComponent(backURL);
console.log('Encoded:', encoded);
// Encoded: https%3A%2F%2Fukidney.com%2Fpage%3Fid%3D123%26ref%3Dtest

// Test decoding (what our code does automatically)
const params = new URLSearchParams(`?back-button=${encoded}`);
const decoded = params.get('back-button');
console.log('Decoded:', decoded);
// Decoded: https://ukidney.com/page?id=123&ref=test
```

### Test Cases

| Input URL | Needs Encoding? | Reason |
|-----------|----------------|---------|
| `https://ukidney.com` | Optional | No special chars |
| `https://ukidney.com/manuals/smh` | Optional | Slashes are safe |
| `https://ukidney.com/page?id=123` | **Required** | Contains `?` |
| `https://ukidney.com/page?id=123&ref=test` | **Required** | Contains `?` and `&` |
| `https://ukidney.com/page#section` | **Required** | Contains `#` |
| `https://ukidney.com/search?q=kidney disease` | **Required** | Contains `?` and space |

## Implementation Recommendations

### 1. Always Encode in Code
When building URLs programmatically, **always use `encodeURIComponent()`**:

```javascript
// ✅ RECOMMENDED: Always encode
function buildChatURL(docSlug, backURL) {
    return `?doc=${encodeURIComponent(docSlug)}&back-button=${encodeURIComponent(backURL)}`;
}
```

### 2. Manual URLs: Encode Complex Ones
For simple manual URLs, encoding is optional but recommended:

```html
<!-- ✅ Simple URL - works without encoding -->
<a href="?doc=smh&back-button=https://ukidney.com">Chat</a>

<!-- ✅ Complex URL - MUST encode -->
<a href="?doc=smh&back-button=https%3A%2F%2Fukidney.com%2Fpage%3Fid%3D123">Chat</a>
```

### 3. Server-Side Generation
When generating URLs server-side, always encode:

```javascript
// Node.js / Express
app.get('/embed-chat', (req, res) => {
    const backURL = req.query.return_url || 'https://ukidney.com';
    const chatURL = `/chat?doc=smh&back-button=${encodeURIComponent(backURL)}`;
    res.redirect(chatURL);
});
```

## Common Pitfalls

### ❌ Double Encoding
Don't encode twice:
```javascript
// ❌ WRONG: Double encoding
const url = encodeURIComponent('https://ukidney.com');
const chatURL = `?doc=smh&back-button=${encodeURIComponent(url)}`;
// Result: https%253A%252F%252Fukidney.com (broken!)
```

### ❌ Encoding the Entire URL
Only encode the parameter value, not the entire URL:
```javascript
// ❌ WRONG: Encoding entire URL
const chatURL = encodeURIComponent('?doc=smh&back-button=https://ukidney.com');

// ✅ CORRECT: Only encode parameter value
const chatURL = `?doc=smh&back-button=${encodeURIComponent('https://ukidney.com')}`;
```

### ❌ Forgetting to Encode User Input
Always encode user-provided URLs:
```javascript
// ❌ WRONG: Using user input directly
const userURL = getUserInput();
const chatURL = `?doc=smh&back-button=${userURL}`;  // Vulnerable!

// ✅ CORRECT: Encode user input
const userURL = getUserInput();
const chatURL = `?doc=smh&back-button=${encodeURIComponent(userURL)}`;
```

## Browser Compatibility

`URLSearchParams` and `encodeURIComponent()` are supported in all modern browsers:
- ✅ Chrome/Edge: All versions
- ✅ Firefox: All versions
- ✅ Safari: All versions
- ✅ Mobile browsers: All modern versions

## Summary

### Quick Rules
1. **Simple URLs** (no `?`, `&`, `#`): Encoding optional but recommended
2. **Complex URLs** (with query params or fragments): **MUST encode**
3. **Programmatic URLs**: **Always encode** with `encodeURIComponent()`
4. **User input**: **Always encode** for security

### Code Template
```javascript
// ✅ Safe template for all cases
function createChatURL(docSlug, backURL) {
    const params = new URLSearchParams();
    params.set('doc', docSlug);
    if (backURL) {
        params.set('back-button', backURL);  // Automatically encodes
    }
    return `?${params.toString()}`;
}

// Usage
const url = createChatURL('smh', 'https://ukidney.com/page?id=123');
// Result: ?doc=smh&back-button=https%3A%2F%2Fukidney.com%2Fpage%3Fid%3D123
```

## Related Documentation

- [BACK-BUTTON-FEATURE.md](BACK-BUTTON-FEATURE.md) - Feature overview
- [URL-PARAMETERS.md](URL-PARAMETERS.md) - All URL parameters
- [MDN: encodeURIComponent()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent)
- [MDN: URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)



