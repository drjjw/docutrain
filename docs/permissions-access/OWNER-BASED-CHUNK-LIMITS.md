# Owner-Based Chunk Limits

## Overview

The system now supports **owner-based chunk limit configuration**, allowing different document owners to have customized chunk retrieval limits based on their specific needs. This provides flexibility to optimize context size for different types of documents.

## Architecture

### Database Schema

#### **owners** Table
```sql
CREATE TABLE owners (
    id UUID PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    default_chunk_limit INTEGER NOT NULL DEFAULT 50 
        CHECK (default_chunk_limit > 0 AND default_chunk_limit <= 200),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **documents** Table (Updated)
- Added `owner_id UUID` column referencing `owners(id)`
- All documents are now associated with an owner

#### **documents_with_owner** View
Convenient view joining documents with their owner information:
```sql
SELECT slug, title, owner_slug, owner_name, default_chunk_limit 
FROM documents_with_owner;
```

### Helper Functions

#### `get_document_chunk_limit(doc_slug TEXT)`
Returns the chunk limit for a single document based on its owner.

```sql
SELECT get_document_chunk_limit('smh');  -- Returns 50
SELECT get_document_chunk_limit('maker-foh');  -- Returns 30
```

#### `get_multi_document_chunk_limit(doc_slugs TEXT[])`
Returns the chunk limit for multi-document queries:
- If all documents have the **same owner**: Returns that owner's limit
- If documents have **different owners**: Returns default (50)

```sql
SELECT get_multi_document_chunk_limit(ARRAY['smh', 'uhn']);  -- Returns 50 (same owner)
SELECT get_multi_document_chunk_limit(ARRAY['smh', 'maker-foh']);  -- Returns 50 (different owners)
```

## Current Owners

### 1. **UKidney Medical** (`ukidney`)
- **Chunk Limit**: 50
- **Description**: Medical nephrology documents requiring comprehensive context
- **Documents**: 
  - All SMH documents (`smh`, `smh-icu-epic`)
  - All UHN documents (`uhn`)
  - All KDIGO guidelines (`kdigo-*`)
  - All AJKD core curriculum (`ajkd-cc-*`)
  - Kamel & Halperin book (`kk`)

### 2. **Maker Pizza** (`maker-pizza`)
- **Chunk Limit**: 30
- **Description**: Restaurant training and operational documents
- **Documents**:
  - All Maker documents (`maker-foh`, `maker-franchise-training`, `maker-prep-recipes`, `maker-menu-deck`)

### 3. **Default Owner** (`default`)
- **Chunk Limit**: 50
- **Description**: Default owner for documents without specific ownership
- **Documents**: Any documents not explicitly assigned to another owner

## How It Works

### Single Document Query
1. User queries a document (e.g., `?doc=maker-foh`)
2. System looks up the document's owner
3. Retrieves owner's `default_chunk_limit` (30 chunks for Maker Pizza)
4. Uses that limit for RAG retrieval

### Multi-Document Query
1. User queries multiple documents (e.g., `?doc=smh+uhn`)
2. System checks if all documents have the same owner
3. If **same owner**: Uses that owner's limit (50 for UKidney)
4. If **different owners**: Uses default limit (50)

## Console Logging

The enhanced logging now shows owner information:

```
================================================================================
🔵 RAG REQUEST RECEIVED
================================================================================
📝 Query: "What is the dose of Cefazolin?"
📊 Request Details:
   - Message length: 35 characters
   - History length: 0 messages
   - Model: gemini
   - Document(s): smh
   - Embedding type: openai
   - Session ID: 123e4567-e89b-12d3-a456-426614174000
   - Owner: UKidney Medical (ukidney)
   - Configured chunk limit: 50

🔍 CHUNK RETRIEVAL:
   - Owner: UKidney Medical
   - Requesting: 50 chunks (owner-configured)
   - Embedding type: openai
   - Similarity threshold: 0.3
   ✓ Retrieved: 50 chunks in 556ms
   ...
```

## Managing Owners

### View All Owners
```sql
SELECT * FROM owners ORDER BY slug;
```

### Add a New Owner
```sql
INSERT INTO owners (slug, name, description, default_chunk_limit, metadata) 
VALUES (
    'new-owner',
    'New Owner Name',
    'Description of this owner',
    40,  -- Custom chunk limit
    '{"type": "custom", "industry": "healthcare"}'::jsonb
);
```

### Update Owner's Chunk Limit
```sql
UPDATE owners 
SET default_chunk_limit = 60 
WHERE slug = 'ukidney';
```

### Assign Document to Owner
```sql
UPDATE documents 
SET owner_id = (SELECT id FROM owners WHERE slug = 'ukidney')
WHERE slug = 'new-document';
```

## Benefits

### 1. **Optimized Context Size**
- Medical documents get more chunks (50) for comprehensive clinical context
- Business documents get fewer chunks (30) for focused, actionable information

### 2. **Cost Optimization**
- Reduce API costs for simpler documents by using fewer chunks
- Maintain quality for complex documents with more chunks

### 3. **Performance Tuning**
- Faster responses for documents with lower chunk limits
- Better accuracy for documents requiring more context

### 4. **Flexibility**
- Easy to adjust chunk limits per owner without code changes
- Can create specialized owners for different document types

### 5. **Multi-Document Intelligence**
- Automatically uses appropriate limit when querying documents from same owner
- Falls back to safe default when mixing documents from different owners

## Configuration Limits

- **Minimum**: 1 chunk
- **Maximum**: 200 chunks
- **Default**: 50 chunks (if owner not found)

## Database Metadata

All conversations now log owner information:

```json
{
  "metadata": {
    "owner_slug": "ukidney",
    "owner_name": "UKidney Medical",
    "chunk_limit_configured": 50,
    "chunk_limit_source": "owner",
    "chunks_used": 50,
    ...
  }
}
```

This allows for analytics on:
- Which owners generate most queries
- Performance differences between owner configurations
- Optimal chunk limits for different document types

## Migration

The migration `add-owners-and-chunk-limits.sql` includes:
1. ✅ Creates `owners` table
2. ✅ Adds `owner_id` to `documents` table
3. ✅ Seeds initial owners (ukidney, maker-pizza, default)
4. ✅ Migrates existing documents to appropriate owners
5. ✅ Creates helper functions for chunk limit lookup
6. ✅ Creates `documents_with_owner` view
7. ✅ Sets up RLS policies
8. ✅ Adds update triggers

## Testing

### Test Single Document
```bash
# SMH (UKidney Medical - 50 chunks)
curl "http://localhost:3456/api/chat" \
  -d '{"message": "What is AKI?", "doc": "smh"}'

# Maker FOH (Maker Pizza - 30 chunks)
curl "http://localhost:3456/api/chat" \
  -d '{"message": "How do I greet customers?", "doc": "maker-foh"}'
```

### Test Multi-Document (Same Owner)
```bash
# SMH + UHN (both UKidney - uses 50 chunks)
curl "http://localhost:3456/api/chat" \
  -d '{"message": "Compare protocols", "doc": "smh+uhn"}'
```

### Test Multi-Document (Different Owners)
```bash
# SMH + Maker FOH (different owners - uses default 50 chunks)
curl "http://localhost:3456/api/chat" \
  -d '{"message": "Tell me something", "doc": "smh+maker-foh"}'
```

## Future Enhancements

Potential additions to the owner system:

1. **Per-Document Overrides**: Allow individual documents to override owner's default
2. **Dynamic Adjustment**: Automatically adjust chunk limits based on query complexity
3. **Owner-Specific Prompts**: Customize system prompts per owner
4. **Rate Limiting**: Set API rate limits per owner
5. **Custom Similarity Thresholds**: Allow owners to configure similarity thresholds
6. **Branding**: Store owner-specific branding (logos, colors) in metadata
7. **Analytics Dashboard**: Owner-specific usage and performance metrics

## Troubleshooting

### Chunk Limit Not Applied
Check if document has an owner:
```sql
SELECT slug, owner_id, owner_slug, default_chunk_limit 
FROM documents_with_owner 
WHERE slug = 'your-document';
```

### Document Has No Owner
Assign to default owner:
```sql
UPDATE documents 
SET owner_id = (SELECT id FROM owners WHERE slug = 'default')
WHERE slug = 'your-document';
```

### Function Returns NULL
Ensure document is active:
```sql
SELECT slug, active FROM documents WHERE slug = 'your-document';
```

## Summary

The owner-based chunk limit system provides:
- ✅ **Flexible configuration** per document owner
- ✅ **Automatic chunk limit selection** based on document ownership
- ✅ **Multi-document intelligence** for same-owner queries
- ✅ **Enhanced logging** with owner information
- ✅ **Database-driven** configuration (no code changes needed)
- ✅ **Backward compatible** with fallback to default limits

This allows you to optimize RAG performance and costs for different types of documents while maintaining a simple, maintainable system.

