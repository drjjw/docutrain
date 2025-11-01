# Owner Default Cover Feature

## Overview
Added support for default cover images at the owner level that can be overridden by document-specific covers.

## Database Changes

### Migration: `add_default_cover_to_owners`
```sql
ALTER TABLE owners 
ADD COLUMN default_cover TEXT;

COMMENT ON COLUMN owners.default_cover IS 'Default cover image URL for all documents owned by this owner. Can be overridden by document-level cover column.';
```

### Schema
- **Table**: `owners`
- **Column**: `default_cover` (TEXT, nullable)
- **Purpose**: Provides a fallback cover image for all documents owned by this owner

## Fallback Logic

The cover image resolution follows this priority:
1. **Document-level cover** (`documents.cover`) - highest priority
2. **Owner default cover** (`owners.default_cover`) - fallback
3. **No cover** (null) - if neither is set

### SQL Example
```sql
SELECT 
    d.slug,
    d.title,
    COALESCE(d.cover, o.default_cover) as effective_cover
FROM documents d
LEFT JOIN owners o ON d.owner_id = o.id;
```

## Backend Implementation

### Updated Files

#### `lib/document-registry.js`
- Updated `loadDocuments()` to fetch `default_cover` from owners table
- Added fallback logic: `const effectiveCover = doc.cover || ownerDefaultCover;`
- The effective cover is stored in the `cover` field of processed documents
- Original owner default is preserved in `owner_default_cover` field for reference

```javascript
// Flatten owner data into document object for easier access
const processedData = (data || []).map(doc => {
    const ownerDefaultCover = doc.owners?.default_cover || null;
    
    // Use document cover if set, otherwise fall back to owner's default_cover
    const effectiveCover = doc.cover || ownerDefaultCover;
    
    return {
        ...docWithoutOwners,
        cover: effectiveCover, // Override with effective cover
        owner_default_cover: ownerDefaultCover // Keep original for reference
    };
});
```

## Frontend Impact

**No frontend changes required!** The frontend already uses `config.cover` and will automatically receive the effective cover (document or owner default) from the API.

### Affected Components
- `public/js/ui.js` - Uses `config.cover` for display (lines 439-451)
- `public/js/document-selector.js` - Shows cover thumbnails (lines 306-310)

## RLS Policies

Existing RLS policies on the `owners` table already allow anonymous read access:
- **Policy**: "Allow anonymous read owners"
- **Roles**: anon
- **Command**: SELECT
- **Condition**: true

No RLS changes needed - the `default_cover` column is automatically accessible.

## Usage Example

### Setting a Default Cover for an Owner
```sql
UPDATE owners
SET default_cover = 'https://example.com/default-cover.jpg'
WHERE slug = 'ukidney';
```

### Overriding with Document-Specific Cover
```sql
UPDATE documents
SET cover = 'https://example.com/specific-cover.jpg'
WHERE slug = 'kdigo-ckd-2024';
```

### Removing Document Override (Falls Back to Owner Default)
```sql
UPDATE documents
SET cover = NULL
WHERE slug = 'kdigo-ckd-2024';
```

## Testing

Current state (as of implementation):
- **CPD Network**: 2 documents, all have document-level covers
- **Maker Pizza**: 4 documents, all have document-level covers  
- **UKidney Medical**: 118 documents, most have no covers (good candidates for owner default)

To test:
1. Set a default cover for UKidney: `UPDATE owners SET default_cover = 'URL' WHERE slug = 'ukidney';`
2. Clear document cache: `localStorage.removeItem('ukidney-documents-cache');`
3. Reload the app - all UKidney documents without covers should now show the owner default

## Benefits

1. **Consistency**: All documents from an owner can share the same cover by default
2. **Flexibility**: Individual documents can still override with their own covers
3. **Efficiency**: Reduces need to set covers on every document
4. **Maintainability**: Change all documents' covers by updating one owner field

## Things to Check After RLS Changes

Since we modified the `owners` table structure:
- ✅ Anonymous read access still works (verified - existing policy covers new column)
- ✅ Service role can update the column (verified - full access policy)
- ✅ No breaking changes to existing queries (verified - column is nullable)
- ✅ Frontend API still works (verified - no changes needed)

## Related Documentation
- [Document Registry Refactor](./document-registry-refactor.md)
- [Owner-Based Chunk Limits](./OWNER-BASED-CHUNK-LIMITS.md)

