# Document Downloads Feature

## Overview

The Downloads feature allows documents to have one or more downloadable files (PDFs, EPUBs, etc.) displayed as buttons in the UI. This is useful for providing users with offline access to documents or alternative formats.

## Database Schema

### Column: `documents.downloads`

- **Type**: `JSONB`
- **Default**: `[]` (empty array)
- **Format**: Array of download objects

Each download object must have:
- `title` (string): Display name for the download button
- `url` (string): Full URL to the downloadable file

### Example Data Structure

```json
[
  {
    "title": "PDF Version",
    "url": "https://example.com/documents/manual.pdf"
  },
  {
    "title": "EPUB Version",
    "url": "https://example.com/documents/manual.epub"
  },
  {
    "title": "Supplementary Materials",
    "url": "https://example.com/documents/supplements.zip"
  }
]
```

## Adding Downloads to Documents

### Single Download

```sql
UPDATE documents 
SET downloads = '[
  {"title": "Download PDF", "url": "https://example.com/document.pdf"}
]'::jsonb
WHERE slug = 'your-document-slug';
```

### Multiple Downloads

```sql
UPDATE documents 
SET downloads = '[
  {"title": "PDF Version", "url": "https://example.com/document.pdf"},
  {"title": "EPUB Version", "url": "https://example.com/document.epub"},
  {"title": "Audio Version", "url": "https://example.com/document.mp3"}
]'::jsonb
WHERE slug = 'your-document-slug';
```

### Removing Downloads

```sql
UPDATE documents 
SET downloads = '[]'::jsonb
WHERE slug = 'your-document-slug';
```

## Frontend Implementation

### Automatic Detection

The frontend automatically detects and displays download buttons when:
1. A document has a non-empty `downloads` array
2. Each download object has both `title` and `url` fields

### UI Behavior

#### Single Document
- Download buttons appear below the header
- Each button shows the download title
- Buttons use the document owner's accent color theme

#### Multiple Documents
- Downloads from all selected documents are combined
- Button tooltips show which document each download belongs to
- Example: "PDF Version - SMH Nephrology Manual"

#### No Downloads
- The download buttons container is hidden
- No visual indication if downloads are not available

### Button Features

- **Icon**: Download arrow icon for visual clarity
- **Hover Effect**: Subtle elevation and shadow on hover
- **Click Behavior**: Opens download in new tab with `download` attribute
- **Mobile Responsive**: Smaller padding and font size on mobile devices
- **Accessibility**: Proper ARIA labels and keyboard navigation

## Styling

Download buttons automatically inherit the accent color from the document owner:

```css
.download-button {
    background: var(--accent-color, #007bff);
}

.download-button:hover {
    background: var(--accent-color-hover, #0056b3);
}
```

### Customization

To override the default styling, modify `/public/css/styles.css`:

```css
.download-button {
    /* Your custom styles */
}
```

## Examples

### Example 1: Medical Manual with PDF

```sql
UPDATE documents 
SET downloads = '[
  {"title": "Download Full Manual (PDF)", "url": "https://cdn.example.com/manuals/smh-manual-2023.pdf"}
]'::jsonb
WHERE slug = 'smh';
```

**Result**: Single download button labeled "Download Full Manual (PDF)"

### Example 2: Research Paper with Multiple Formats

```sql
UPDATE documents 
SET downloads = '[
  {"title": "PDF", "url": "https://cdn.example.com/papers/kdigo-2024.pdf"},
  {"title": "EPUB", "url": "https://cdn.example.com/papers/kdigo-2024.epub"},
  {"title": "Supplementary Data", "url": "https://cdn.example.com/papers/kdigo-2024-supplement.xlsx"}
]'::jsonb
WHERE slug = 'kdigo-ckd-2024';
```

**Result**: Three download buttons side by side

### Example 3: Multi-Document Query

When viewing multiple documents with URL: `?doc=doc1+doc2`

If both documents have downloads:
- All download buttons are displayed
- Tooltips indicate which document each belongs to
- Buttons are arranged in a flex wrap layout

## File Hosting Recommendations

### Best Practices

1. **Use CDN**: Host files on a CDN for fast global access
2. **HTTPS Only**: Always use secure URLs
3. **Stable URLs**: Ensure URLs remain stable over time
4. **File Size**: Consider compression for large files
5. **CORS**: Configure CORS headers if hosting on different domain

### Hosting Options

- **Supabase Storage**: Built-in file storage with CDN
- **AWS S3 + CloudFront**: Scalable and reliable
- **Google Cloud Storage**: Good for large files
- **GitHub Releases**: For open-source documents
- **Self-hosted**: On same server as application

## Testing

### Manual Testing Checklist

- [ ] Single download displays correctly
- [ ] Multiple downloads display side by side
- [ ] Download buttons work (file downloads)
- [ ] Buttons use correct accent color
- [ ] Hover effects work properly
- [ ] Mobile responsive layout works
- [ ] Multi-document downloads show correct tooltips
- [ ] Empty downloads array hides container

### Test Document Setup

```sql
-- Create test document with downloads
UPDATE documents 
SET downloads = '[
  {"title": "Test PDF", "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"},
  {"title": "Test EPUB", "url": "https://example.com/test.epub"}
]'::jsonb
WHERE slug = 'test-document';
```

## Troubleshooting

### Downloads Not Appearing

1. **Check Database**: Verify `downloads` column has valid JSON
   ```sql
   SELECT slug, downloads FROM documents WHERE slug = 'your-slug';
   ```

2. **Check Console**: Look for JavaScript errors in browser console
   - Should see: `📥 Created N download button(s)`
   - Or: `📥 No downloads available for current document(s)`

3. **Validate JSON**: Ensure each object has `title` and `url`
   ```javascript
   // Valid
   {"title": "PDF", "url": "https://..."}
   
   // Invalid (missing url)
   {"title": "PDF"}
   ```

### Buttons Not Styled Correctly

1. **Clear Cache**: Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+F5)
2. **Check CSS**: Verify styles.css includes download button styles
3. **Check Accent Color**: Verify document owner has accent color configured

### Downloads Not Working

1. **Check URL**: Verify URL is accessible
2. **Check CORS**: Ensure server allows downloads from your domain
3. **Check File**: Verify file exists at the URL

## Security Considerations

### RLS (Row Level Security)

The `downloads` column is subject to the same RLS policies as other document columns:

```sql
-- Users can read downloads for active documents
CREATE POLICY "Allow read access to active documents"
ON documents FOR SELECT
USING (active = true);
```

**Important**: When updating RLS policies, verify that:
- [ ] Downloads remain accessible for active documents
- [ ] Downloads are hidden for inactive documents
- [ ] Multi-tenant isolation is maintained (if applicable)

### URL Validation

**Backend**: No validation is performed on URLs in the database. Ensure URLs are:
- From trusted sources
- HTTPS when possible
- Not pointing to sensitive internal resources

**Frontend**: URLs are used directly in `<a>` tags with:
- `target="_blank"` - Opens in new tab
- `rel="noopener noreferrer"` - Security best practice
- `download` attribute - Suggests download behavior

## Future Enhancements

Potential improvements for this feature:

1. **File Size Display**: Show file size next to download button
2. **File Type Icons**: Different icons for PDF, EPUB, ZIP, etc.
3. **Download Analytics**: Track download counts
4. **Access Control**: Restrict downloads to authenticated users
5. **Expiring URLs**: Support for time-limited download links
6. **Preview**: Quick preview before downloading
7. **Batch Download**: Download all files as ZIP

## Related Documentation

- [Document Registry Guide](./docs-setup/DOCUMENT-REGISTRY.md)
- [Multi-Document RAG](./MULTI-DOCUMENT-RAG-IMPLEMENTATION.md)
- [Database Schema](./docs-setup/DATABASE-SCHEMA.md)
- [URL Parameters](./URL-PARAMETERS.md)

## Support

For issues or questions:
1. Check console logs for error messages
2. Verify database schema matches documentation
3. Test with simple example first
4. Review browser network tab for failed requests


