# Downloads Feature - Quick Reference

## Add Downloads to a Document

### Single Download
```sql
UPDATE documents 
SET downloads = '[{"title": "Download PDF", "url": "https://example.com/file.pdf"}]'::jsonb
WHERE slug = 'document-slug';
```

### Multiple Downloads
```sql
UPDATE documents 
SET downloads = '[
  {"title": "PDF", "url": "https://example.com/file.pdf"},
  {"title": "EPUB", "url": "https://example.com/file.epub"}
]'::jsonb
WHERE slug = 'document-slug';
```

### Remove Downloads
```sql
UPDATE documents 
SET downloads = '[]'::jsonb
WHERE slug = 'document-slug';
```

## JSON Format

```json
[
  {
    "title": "Display Name",
    "url": "https://full-url-to-file.pdf"
  }
]
```

**Required Fields:**
- `title`: Button text (string)
- `url`: Download URL (string)

## Common Use Cases

### Medical Manual
```json
[{"title": "Download Full Manual", "url": "https://cdn.example.com/manual.pdf"}]
```

### Research Paper with Supplements
```json
[
  {"title": "Main Paper (PDF)", "url": "https://cdn.example.com/paper.pdf"},
  {"title": "Supplementary Materials", "url": "https://cdn.example.com/supplement.pdf"}
]
```

### Multiple Formats
```json
[
  {"title": "PDF", "url": "https://cdn.example.com/doc.pdf"},
  {"title": "EPUB", "url": "https://cdn.example.com/doc.epub"},
  {"title": "MOBI", "url": "https://cdn.example.com/doc.mobi"}
]
```

## Troubleshooting

### Buttons Not Showing?
1. Check console: `📥 Created N download button(s)` or `📥 No downloads available`
2. Verify JSON format is correct
3. Ensure both `title` and `url` are present

### Wrong Color?
- Buttons inherit accent color from document owner
- Check owner configuration in `owners` table

### Download Not Working?
1. Verify URL is accessible
2. Check CORS settings if cross-domain
3. Ensure file exists at URL

## Testing

```sql
-- Test with dummy PDF
UPDATE documents 
SET downloads = '[{
  "title": "Test PDF", 
  "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
}]'::jsonb
WHERE slug = 'test-doc';
```

Then visit: `?doc=test-doc`

## See Also

- [Full Documentation](./DOWNLOADS-FEATURE.md)
- [Document Registry](./docs-setup/DOCUMENT-REGISTRY.md)


