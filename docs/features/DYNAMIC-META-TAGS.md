# Dynamic Meta Tags Implementation

## Overview

This document explains how dynamic meta tags are implemented to ensure that search engines and social media crawlers can properly index and display document-specific information when sharing links to the application.

## Problem Statement

Initially, the application used JavaScript to update meta tags dynamically based on the `?doc=` URL parameter. However, this approach had a critical flaw:

**Web crawlers and social media scrapers (Facebook, Twitter, LinkedIn, etc.) do not execute JavaScript.** They only read the static HTML that the server sends. This meant that all shared links would show the generic "AI Document Assistant" title instead of the specific document title.

## Solution: Server-Side Meta Tag Injection

The solution involves dynamically generating the HTML on the server side before sending it to the client. This ensures that crawlers see the correct meta tags without needing to execute JavaScript.

### Implementation Details

#### 1. Middleware Order (Critical!)

**Important:** The `express.static('public')` middleware must be placed AFTER the custom route handlers, not before. This ensures that our dynamic route handler processes requests to `/` before Express tries to serve the static `index.html` file.

```javascript
// ❌ WRONG - Static middleware first
app.use(express.static('public'));  // This will serve index.html directly
app.get('/', async (req, res) => { /* Never reached! */ });

// ✅ CORRECT - Custom routes first
app.get('/', async (req, res) => { /* Handles / with dynamic meta tags */ });
app.use(express.static('public'));  // Serves other static files
```

**Location in code:** Lines 63 and 1105 in `server.js`

#### 2. Static Meta Tags in HTML

The base `index.html` file now includes default meta tags:

```html
<title>AI Document Assistant</title>
<meta name="description" content="AI-powered document assistant for medical guidelines and research papers">
<meta property="og:title" content="AI Document Assistant">
<meta property="og:description" content="AI-powered document assistant for medical guidelines and research papers">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="AI Document Assistant">
<meta name="twitter:description" content="AI-powered document assistant for medical guidelines and research papers">
```

#### 3. Server-Side Route Handlers

The server intercepts requests to `/` and `/index.php` and dynamically modifies the HTML before sending it to the client.

**Key Features:**
- Reads the `?doc=` URL parameter
- Supports multi-document queries (e.g., `?doc=doc1+doc2`)
- Fetches document metadata from the database via `documentRegistry.getDocumentBySlug()`
- Escapes HTML to prevent XSS attacks
- Replaces meta tags with document-specific information
- Falls back to static file serving on errors

**Code Location:** `server.js` lines 928-1095

```javascript
// Helper function to escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Root route - serve index.html with dynamic meta tags
app.get('/', async (req, res) => {
    try {
        const indexPath = path.join(__dirname, 'public', 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');
        
        const docParam = req.query.doc;
        
        if (docParam) {
            const docSlugs = docParam.split('+').map(s => s.trim()).filter(s => s);
            
            if (docSlugs.length > 0) {
                const docConfigs = await Promise.all(
                    docSlugs.map(slug => documentRegistry.getDocumentBySlug(slug))
                );
                
                const validConfigs = docConfigs.filter(c => c !== null);
                
                if (validConfigs.length > 0) {
                    const isMultiDoc = validConfigs.length > 1;
                    const combinedTitle = validConfigs.map(c => c.title).join(' + ');
                    const metaDescription = isMultiDoc 
                        ? `Multi-document search across ${validConfigs.length} documents: ${combinedTitle}`
                        : (validConfigs[0].subtitle || validConfigs[0].welcome_message || 'AI-powered document assistant');
                    
                    // Escape HTML to prevent XSS
                    const escapedTitle = escapeHtml(combinedTitle);
                    const escapedDescription = escapeHtml(metaDescription);
                    
                    // Replace meta tags in HTML
                    html = html.replace(/<title>.*?<\/title>/, `<title>${escapedTitle}</title>`);
                    html = html.replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${escapedDescription}">`);
                    html = html.replace(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${escapedTitle}">`);
                    html = html.replace(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${escapedDescription}">`);
                    html = html.replace(/<meta name="twitter:title" content=".*?">/, `<meta name="twitter:title" content="${escapedTitle}">`);
                    html = html.replace(/<meta name="twitter:description" content=".*?">/, `<meta name="twitter:description" content="${escapedDescription}">`);
                }
            }
        }
        
        res.send(html);
    } catch (error) {
        console.error('Error serving index.html with dynamic meta tags:', error);
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});
```

#### 4. Client-Side Enhancement (Optional)

While the server-side implementation handles crawlers, the client-side JavaScript in `ui.js` also updates meta tags for better user experience when navigating within the app:

**Code Location:** `public/js/ui.js` lines 8-46

```javascript
function updateMetaTags(title, description) {
    document.title = title;
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
        metaDescription.setAttribute('content', description);
    }
    
    // Update Open Graph and Twitter Card meta tags
    // ... (similar updates for all meta tags)
}
```

This function is called in `updateDocumentUI()` when a document is loaded.

## Security Considerations

### XSS Prevention

All user-controlled content (document titles and descriptions from the database) is escaped using the `escapeHtml()` function before being injected into the HTML. This prevents Cross-Site Scripting (XSS) attacks.

The `escapeHtml()` function escapes the following characters:
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&#039;`

## Meta Tags Included

### Standard HTML
- `<title>` - Page title shown in browser tabs and search results

### SEO
- `<meta name="description">` - Page description for search engines

### Open Graph (Facebook, LinkedIn)
- `<meta property="og:title">` - Title when shared on social media
- `<meta property="og:description">` - Description when shared
- `<meta property="og:type">` - Content type (set to "website")

### Twitter Cards
- `<meta name="twitter:card">` - Card type (set to "summary")
- `<meta name="twitter:title">` - Title on Twitter
- `<meta name="twitter:description">` - Description on Twitter

## Examples

### Single Document
**URL:** `https://example.com/?doc=kdigo-ckd-2024`

**Generated Meta Tags:**
```html
<title>KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease</title>
<meta name="description" content="KDIGO 2024 CKD Guideline">
<meta property="og:title" content="KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease">
```

### Multi-Document
**URL:** `https://example.com/?doc=kdigo-ckd-2024+kdigo-diabetes-2022`

**Generated Meta Tags:**
```html
<title>KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease + KDIGO 2022 Clinical Practice Guideline for Diabetes Management in Chronic Kidney Disease</title>
<meta name="description" content="Multi-document search across 2 documents: KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease + KDIGO 2022 Clinical Practice Guideline for Diabetes Management in Chronic Kidney Disease">
```

### No Document Parameter
**URL:** `https://example.com/`

**Generated Meta Tags:** (defaults)
```html
<title>AI Document Assistant</title>
<meta name="description" content="AI-powered document assistant for medical guidelines and research papers">
```

## Testing

### How to Test with Social Media Crawlers

1. **Facebook Sharing Debugger**
   - URL: https://developers.facebook.com/tools/debug/
   - Enter your URL with `?doc=` parameter
   - Click "Scrape Again" to see what Facebook sees

2. **Twitter Card Validator**
   - URL: https://cards-dev.twitter.com/validator
   - Enter your URL with `?doc=` parameter
   - View the preview card

3. **LinkedIn Post Inspector**
   - URL: https://www.linkedin.com/post-inspector/
   - Enter your URL with `?doc=` parameter
   - See how LinkedIn will display the link

### Manual Testing

1. View page source (Ctrl+U or Cmd+U) with different `?doc=` parameters
2. Verify that the `<title>` and meta tags in the HTML source match the document
3. Check browser DevTools → Network tab → Response to see the actual HTML sent by the server

## Performance Considerations

- The HTML file is read synchronously on each request using `fs.readFileSync()`
- Document metadata is fetched from the database (with 5-minute caching via document registry)
- String replacements are performed using regex
- For high-traffic scenarios, consider:
  - Caching the base HTML in memory
  - Using a template engine (e.g., EJS, Handlebars)
  - Implementing server-side rendering (SSR) framework

## Files Modified

1. **`public/index.html`** - Added default meta tags
2. **`public/js/ui.js`** - Added `updateMetaTags()` function for client-side updates
3. **`server.js`** - Added dynamic meta tag injection for `/` and `/index.php` routes
4. **`dist/public/index.html`** - Mirrored changes for production
5. **`dist/server.js`** - Mirrored changes for production

## Future Enhancements

1. **Add `og:image` meta tag** - Include document cover images for richer social media previews
2. **Add `og:url` canonical URL** - Specify the canonical URL for the page
3. **Add structured data (JSON-LD)** - Enhance SEO with schema.org markup
4. **Cache rendered HTML** - Improve performance by caching rendered pages
5. **Add sitemap generation** - Help search engines discover all documents

## Related Documentation

- [URL Parameters](./URL-PARAMETERS.md) - How URL parameters work
- [Document Registry](./MODULAR-STRUCTURE.md) - How documents are loaded from database
- [Cache Management](./CACHE-MANAGEMENT.md) - Caching strategies

