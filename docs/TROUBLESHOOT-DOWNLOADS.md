# Troubleshooting Downloads Not Appearing

## Issue
Download button not showing for obesity-management-2024 document

## Checklist

### 1. ✅ Database Updated
- SQL has been run to add downloads to the document

### 2. ✅ Frontend Code Built
- `updateDownloadButtons()` function exists in ui.js
- CSS styles exist for download buttons
- Code is in /public folder (server serves from here in dev mode)

### 3. 🔍 Cache Issues to Check

#### Browser Cache
1. Hard refresh the page: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+F5** (Windows)
2. Or open in incognito/private window

#### LocalStorage Cache
The app caches document configs in localStorage for 5 minutes.

**Clear it manually:**
1. Open browser console (F12)
2. Run: `localStorage.removeItem('ukidney-documents-cache')`
3. Refresh the page

Or visit with cache-busting parameter:
```
http://localhost:3456/?doc=obesity-management-2024&t=123456
```

### 4. 🔍 Check Console Messages

Open browser console and look for:
- ✅ `📥 Created 1 download button(s)` = Working!
- ⚠️ `📥 No downloads available for current document(s)` = Not getting downloads from DB

### 5. 🔍 Verify Database

Run this in Supabase SQL Editor to confirm:
```sql
SELECT slug, title, downloads 
FROM documents 
WHERE slug = 'obesity-management-2024';
```

Should return:
```json
{
  "downloads": [
    {
      "title": "Download PDF",
      "url": "https://mlxctdgnojvkgfqldaob.supabase.co/storage/v1/object/public/downloads/..."
    }
  ]
}
```

### 6. 🔍 Check Document Config

In browser console, run:
```javascript
// Check if config has downloads
import('./js/config.js').then(m => m.getDocument('obesity-management-2024', true)).then(console.log)
```

Look for `downloads` array in the output.

### 7. 🔄 Restart Server (if needed)

```bash
# Kill the server
pkill -f "node.*server.js"

# Start it again
node server.js
```

## Quick Fix Steps

1. **Clear localStorage**: `localStorage.removeItem('ukidney-documents-cache')`
2. **Hard refresh**: Cmd+Shift+R
3. **Check console**: Look for `📥` messages
4. **Verify database**: Confirm downloads field exists

## Expected Result

When working, you should see:
- Download button below the header
- Console message: `📥 Created 1 download button(s)`
- Button labeled "Download PDF"
- Clicking downloads the file

