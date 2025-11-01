# Downloads Feature - Quick Start Guide

## ✅ Migration Complete!

The `downloads` column has been successfully added to the `documents` table and is ready to use.

## How to Add Downloads to a Document

### Single Download
```sql
UPDATE documents 
SET downloads = '[
  {"title": "Download PDF", "url": "https://example.com/your-file.pdf"}
]'::jsonb
WHERE slug = 'your-document-slug';
```

### Multiple Downloads
```sql
UPDATE documents 
SET downloads = '[
  {"title": "PDF Version", "url": "https://example.com/file.pdf"},
  {"title": "EPUB Version", "url": "https://example.com/file.epub"},
  {"title": "Supplementary Materials", "url": "https://example.com/supplement.pdf"}
]'::jsonb
WHERE slug = 'your-document-slug';
```

## JSON Format

Each download must have:
- **`title`**: Button text (string)
- **`url`**: Full URL to file (string)

```json
[
  {
    "title": "Display Name",
    "url": "https://full-url-to-file.pdf"
  }
]
```

## What Happens in the UI

When you add downloads to a document:

1. **Download buttons appear** below the header
2. **Single download** = One button
3. **Multiple downloads** = Multiple buttons side by side
4. **No downloads** (`[]`) = No buttons shown
5. **Multi-document** = All downloads combined with tooltips

## Example: Add Download to SMH Manual

```sql
UPDATE documents 
SET downloads = '[
  {"title": "Download Full Manual", "url": "https://your-cdn.com/smh-manual-2023.pdf"}
]'::jsonb
WHERE slug = 'smh';
```

Then visit: `https://your-domain.com/?doc=smh`

You'll see a download button below the header! 📥

## Remove Downloads

```sql
UPDATE documents 
SET downloads = '[]'::jsonb
WHERE slug = 'your-document-slug';
```

## Testing

Use the test file: `test-downloads.html`

Or test with a dummy PDF:
```sql
UPDATE documents 
SET downloads = '[{
  "title": "Test PDF", 
  "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
}]'::jsonb
WHERE slug = 'smh';
```

## Documentation

- **Full Documentation**: `/docs/DOWNLOADS-FEATURE.md`
- **Quick Reference**: `/docs/DOWNLOADS-QUICK-REFERENCE.md`
- **Implementation Summary**: `/DOWNLOADS-IMPLEMENTATION-SUMMARY.md`
- **Test Suite**: `/test-downloads.html`
- **Migration File**: `/migrations/add_downloads_column.sql`

## Troubleshooting

### Buttons not showing?
1. Check browser console for: `📥 Created N download button(s)`
2. Verify JSON format is correct
3. Make sure both `title` and `url` are present

### Check current downloads:
```sql
SELECT slug, title, downloads 
FROM documents 
WHERE slug = 'your-slug';
```

## Next Steps

1. Choose which documents should have downloads
2. Host your files on a CDN or file server
3. Add the download URLs to the database
4. Test on your site!

---

**Status**: ✅ Ready to Use  
**Migration**: ✅ Complete  
**Frontend**: ✅ Implemented  
**Documentation**: ✅ Complete

