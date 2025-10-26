# URL Encoding Cheat Sheet

Quick reference for encoding back button URLs.

## 🚀 Quick Start

### JavaScript (Browser)
```javascript
// ✅ BEST: Use this for all cases
const backURL = 'https://brightbean.io/page?id=123&ref=test';
const chatURL = `?doc=smh&back-button=${encodeURIComponent(backURL)}`;
```

### URLSearchParams (Automatic)
```javascript
// ✅ ALSO GOOD: Automatic encoding
const params = new URLSearchParams();
params.set('doc', 'smh');
params.set('back-button', backURL);
const chatURL = `?${params.toString()}`;
```

## 📋 When to Encode

| URL | Needs Encoding? | Why |
|-----|----------------|-----|
| `https://brightbean.io` | Optional | No special chars |
| `https://brightbean.io/manuals/smh` | Optional | Slashes are safe |
| `https://brightbean.io/page?id=123` | **REQUIRED** | Contains `?` |
| `https://brightbean.io/page?a=1&b=2` | **REQUIRED** | Contains `?` and `&` |
| `https://brightbean.io/page#section` | **REQUIRED** | Contains `#` |
| `https://brightbean.io/kidney disease` | **REQUIRED** | Contains space |

## ✅ Correct Examples

### Simple URL (No Encoding Needed)
```
?doc=smh&back-button=https://brightbean.io
```

### Complex URL (Must Encode)
```
?doc=smh&back-button=https%3A%2F%2Fbrightbean.io%2Fpage%3Fid%3D123
```

### Building Dynamically
```javascript
// Method 1: encodeURIComponent
const url = `?doc=smh&back-button=${encodeURIComponent(backURL)}`;

// Method 2: URLSearchParams
const params = new URLSearchParams({ doc: 'smh', 'back-button': backURL });
const url = `?${params}`;
```

## ❌ Common Mistakes

### Mistake 1: Not Encoding Complex URLs
```javascript
// ❌ WRONG - Will break!
const url = '?doc=smh&back-button=https://brightbean.io/page?id=123&ref=test';
//                                                          ↑       ↑
//                                     These will be parsed as separate parameters!

// ✅ CORRECT
const backURL = 'https://brightbean.io/page?id=123&ref=test';
const url = `?doc=smh&back-button=${encodeURIComponent(backURL)}`;
```

### Mistake 2: Double Encoding
```javascript
// ❌ WRONG - Encoding twice!
const encoded = encodeURIComponent(backURL);
const url = `?doc=smh&back-button=${encodeURIComponent(encoded)}`;

// ✅ CORRECT - Encode once
const url = `?doc=smh&back-button=${encodeURIComponent(backURL)}`;
```

### Mistake 3: Encoding Entire URL
```javascript
// ❌ WRONG - Don't encode the entire URL!
const url = encodeURIComponent('?doc=smh&back-button=https://brightbean.io');

// ✅ CORRECT - Only encode parameter values
const url = `?doc=smh&back-button=${encodeURIComponent(backURL)}`;
```

## 🔧 Helper Functions

### Reusable Function
```javascript
function buildChatURL(docSlug, backURL, options = {}) {
    const params = new URLSearchParams();
    params.set('doc', docSlug);
    
    if (backURL) {
        params.set('back-button', backURL);
    }
    
    if (options.method) {
        params.set('method', options.method);
    }
    
    return `?${params.toString()}`;
}

// Usage
buildChatURL('smh', 'https://brightbean.io');
buildChatURL('uhn', 'https://brightbean.io/page?id=123', { method: 'rag' });
buildChatURL('smh', null); // No back button
```

### Validation Function
```javascript
function needsEncoding(url) {
    return /[?&#=+\s]/.test(url);
}

// Usage
if (needsEncoding(backURL)) {
    console.log('⚠️ This URL must be encoded!');
}
```

## 🌍 Real-World Examples

### Example 1: Current Page as Back Link
```javascript
const chatURL = `/chat?doc=smh&back-button=${encodeURIComponent(window.location.href)}`;
```

### Example 2: Referrer as Back Link
```javascript
const backURL = document.referrer || 'https://brightbean.io';
const chatURL = `/chat?doc=smh&back-button=${encodeURIComponent(backURL)}`;
```

### Example 3: HTML Link
```html
<!-- Simple URL -->
<a href="?doc=smh&back-button=https://brightbean.io">Chat</a>

<!-- Complex URL (pre-encoded) -->
<a href="?doc=smh&back-button=https%3A%2F%2Fbrightbean.io%2Fpage%3Fid%3D123">Chat</a>
```

### Example 4: Iframe Embed
```javascript
const backURL = 'https://brightbean.io/manuals/smh';
const iframe = document.createElement('iframe');
iframe.src = `/chat?doc=smh&back-button=${encodeURIComponent(backURL)}`;
document.body.appendChild(iframe);
```

### Example 5: Server-Side (Node.js)
```javascript
app.get('/chat-redirect', (req, res) => {
    const backURL = req.query.return_url || 'https://brightbean.io';
    const params = new URLSearchParams({
        doc: 'smh',
        'back-button': backURL
    });
    res.redirect(`/chat?${params}`);
});
```

## 🧪 Testing

### Browser Console Test
```javascript
// Test encoding
const backURL = 'https://brightbean.io/page?id=123&ref=test';
const encoded = encodeURIComponent(backURL);
console.log('Encoded:', encoded);
// Encoded: https%3A%2F%2Fbrightbean.io%2Fpage%3Fid%3D123%26ref%3Dtest

// Test decoding (what URLSearchParams does)
const params = new URLSearchParams(`?back-button=${encoded}`);
console.log('Decoded:', params.get('back-button'));
// Decoded: https://brightbean.io/page?id=123&ref=test
```

### Interactive Tool
Open `encoding-examples.html` in your browser for an interactive encoding tool!

## 📚 Related Documentation

- [BACK-BUTTON-FEATURE.md](BACK-BUTTON-FEATURE.md) - Feature overview
- [BACK-BUTTON-URL-ENCODING.md](BACK-BUTTON-URL-ENCODING.md) - Detailed encoding guide
- [URL-PARAMETERS.md](URL-PARAMETERS.md) - All URL parameters

## 🎯 TL;DR

**Rule of thumb:** When building URLs in code, **always use `encodeURIComponent()`** or `URLSearchParams`. It's safer and handles all edge cases automatically.

```javascript
// ✅ This always works
const chatURL = `?doc=smh&back-button=${encodeURIComponent(backURL)}`;
```

