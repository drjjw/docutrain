# Forced Grok Model Feature

## Overview

The forced Grok model system provides hierarchical model enforcement with both **owner-level** and **document-level** overrides. This safety mechanism ensures critical content uses appropriate AI models regardless of user selection.

**Hierarchy (Highest to Lowest Priority):**
1. **Document-level override** (`documents.forced_grok_model`) - Takes precedence
2. **Owner-level override** (`owners.forced_grok_model`) - Applies to all owner's documents
3. **Multi-document conflict resolution** - Uses `grok-reasoning` when documents conflict
4. **User selection** - Respected when no overrides exist

## Database Schema

### Owner-Level Override: `owners.forced_grok_model`

- **Type**: `text`
- **Nullable**: Yes (NULL means no override)
- **Allowed Values**:
  - `'grok'` - Standard Grok model (`grok-4-fast-non-reasoning`)
  - `'grok-reasoning'` - Reasoning Grok model (`grok-4-fast-reasoning`)
  - `NULL` - No override (user choice respected)
- **Applies to**: All documents belonging to this owner
- **Constraint**: `CHECK (forced_grok_model IS NULL OR forced_grok_model IN ('grok', 'grok-reasoning'))`

### Document-Level Override: `documents.forced_grok_model`

- **Type**: `text`
- **Nullable**: Yes (NULL means no override)
- **Allowed Values**:
  - `'grok'` - Standard Grok model (`grok-4-fast-non-reasoning`)
  - `'grok-reasoning'` - Reasoning Grok model (`grok-4-fast-reasoning`)
  - `NULL` - No override (check owner-level)
- **Precedence**: Takes precedence over owner-level override
- **Use case**: Fine-grained control for specific documents
- **Constraint**: `CHECK (forced_grok_model IS NULL OR forced_grok_model IN ('grok', 'grok-reasoning'))`

## How It Works

### Single Document Queries

1. **User Makes Request**: User selects a model (e.g., `grok` or `grok-reasoning`)
2. **Document & Owner Check**: Server fetches document and owner information
3. **Override Logic** (hierarchical):
   - **First**: Check `documents.forced_grok_model` - if set, use it
   - **Second**: Check `owners.forced_grok_model` - if set, use it
   - **Fallback**: User choice respected
4. **Gemini Bypass**: If user selected Gemini → No override (only applies to Grok models)

### Multi-Document Queries

1. **Collect Overrides**: Gather all `document_forced_grok_model` values from requested documents
2. **Conflict Resolution**:
   - If any document requires `grok-reasoning` → Use `grok-reasoning`
   - If documents have conflicting overrides → Use `grok-reasoning` (safest option)
   - If all documents agree on same override → Use that override
   - If no document overrides → Check owner-level (only if all docs have same owner)
3. **Logging**: All overrides logged in conversation metadata for audit purposes

## Use Cases

### Owner-Level Overrides

#### Medical Documents (UKidney)
Medical nephrology documents require comprehensive reasoning and careful analysis. Force the reasoning model for all UKidney documents:

```sql
UPDATE owners
SET forced_grok_model = 'grok-reasoning',
    updated_at = now()
WHERE slug = 'ukidney';
```

#### Training Documents (Maker Pizza)
Restaurant training documents may benefit from faster responses without deep reasoning:

```sql
UPDATE owners
SET forced_grok_model = 'grok',
    updated_at = now()
WHERE slug = 'maker-pizza';
```

#### Default/General Documents
No override - let users choose:

```sql
UPDATE owners
SET forced_grok_model = NULL,
    updated_at = now()
WHERE slug = 'default';
```

### Document-Level Overrides

#### Exception Documents
Override a specific document within an owner group. For example, make one training document use reasoning while others use standard:

```sql
-- Most Maker Pizza docs use standard model
UPDATE owners
SET forced_grok_model = 'grok'
WHERE slug = 'maker-pizza';

-- But this specific complex procedure requires reasoning
UPDATE documents
SET forced_grok_model = 'grok-reasoning'
WHERE slug = 'maker-complex-procedure';
```

#### Beta Testing New Models
Test a new model on specific documents before rolling out owner-wide:

```sql
-- Test reasoning model on one UKidney document
UPDATE documents
SET forced_grok_model = 'grok-reasoning'
WHERE slug = 'smh';
```

#### Sensitive Content Override
Force reasoning for documents containing sensitive medical information:

```sql
-- Critical patient care document gets maximum reasoning
UPDATE documents
SET forced_grok_model = 'grok-reasoning'
WHERE slug = 'confidential-treatment-protocol';
```

## Implementation

### Server-Side Override Logic (server.js)

```javascript
// Apply forced Grok model override if configured for this owner
let originalModel = model;
if (ownerInfo?.forced_grok_model && (model === 'grok' || model === 'grok-reasoning')) {
    originalModel = model;
    model = ownerInfo.forced_grok_model;
    console.log(`🔒 FORCED MODEL OVERRIDE:`);
    console.log(`   - Owner: ${ownerInfo.owner_name}`);
    console.log(`   - User requested: ${originalModel}`);
    console.log(`   - Forced to use: ${model}`);
    console.log(`   - Reason: Owner-configured safety mechanism`);
}
```

### Client-Side Detection (chat.js)

The client detects model overrides after receiving the server response:

```javascript
// Log the actual model being used and detect overrides
if (data.actualModel) {
    const requestedModel = state.selectedModel;
    const actualModel = data.actualModel;
    
    // Map requested model to expected actual model
    const expectedActual = requestedModel === 'grok' ? 'grok-4-fast-non-reasoning' :
                         requestedModel === 'grok-reasoning' ? 'grok-4-fast-reasoning' :
                         'gemini-2.5-flash';
    
    // Detect if override occurred
    const wasOverridden = expectedActual !== actualModel;
    
    if (wasOverridden) {
        console.log('\n🔒 MODEL OVERRIDE DETECTED:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  Requested:  ${requestedModel} (${expectedActual})`);
        console.log(`  Actually used: ${actualModel}`);
        console.log(`  Reason: Owner-configured safety mechanism`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
}
```

### Server Metadata Logging

The following fields are added to conversation metadata:
- `forced_grok_model`: The configured forced model (or null)
- `model_override_applied`: Boolean indicating if override was applied
- `original_model_requested`: The model the user originally requested (if overridden)

## Database Queries

### View Current Settings

**Owner-level settings:**
```sql
SELECT
    slug,
    name,
    default_chunk_limit,
    forced_grok_model,
    description
FROM owners
ORDER BY name;
```

**Document-level settings:**
```sql
SELECT
    d.slug,
    d.title,
    d.forced_grok_model as document_override,
    o.name as owner_name,
    o.forced_grok_model as owner_override
FROM documents d
LEFT JOIN owners o ON d.owner_id = o.id
WHERE d.active = true
ORDER BY o.name, d.slug;
```

**Documents with overrides:**
```sql
SELECT
    d.slug,
    d.title,
    d.forced_grok_model as document_override,
    o.name as owner_name,
    o.forced_grok_model as owner_override,
    CASE
        WHEN d.forced_grok_model IS NOT NULL THEN 'document'
        WHEN o.forced_grok_model IS NOT NULL THEN 'owner'
        ELSE 'none'
    END as override_level
FROM documents d
LEFT JOIN owners o ON d.owner_id = o.id
WHERE d.active = true
AND (d.forced_grok_model IS NOT NULL OR o.forced_grok_model IS NOT NULL)
ORDER BY o.name, d.slug;
```

### Check Override Usage

```sql
-- Find conversations where model override was applied
SELECT
    id,
    question,
    model,
    metadata->>'original_model_requested' as user_requested,
    metadata->>'forced_grok_model' as forced_model,
    metadata->>'owner_name' as owner,
    metadata->>'override_source' as override_type,
    created_at
FROM chat_conversations
WHERE metadata->>'model_override_applied' = 'true'
ORDER BY created_at DESC
LIMIT 20;
```

### Statistics by Override Type

```sql
-- Count overrides by type and source
SELECT
    metadata->>'override_source' as override_type,
    metadata->>'owner_name' as owner,
    COUNT(*) as override_count
FROM chat_conversations
WHERE metadata->>'model_override_applied' = 'true'
GROUP BY metadata->>'override_source', metadata->>'owner_name'
ORDER BY override_count DESC;
```

## Important Considerations

### RLS Impact
When modifying the `owners` table or `documents_with_owner` view:
- ✅ Verify RLS policies still work correctly
- ✅ Test document access with different owners
- ✅ Check that chunk retrieval respects owner boundaries
- ✅ Ensure multi-document queries handle mixed owners properly

### User Experience
- Users are NOT notified in the UI when their model choice is overridden
- The override is transparent to the end user (no visual indication)
- **Browser console logs show when override occurs** (for developers/debugging)
- Server logs capture detailed override information for audit purposes

#### Console Output Examples

**Owner-Level Override:**
When a user selects `grok` for a UKidney document with owner-level override:

```
🔒 FORCED MODEL OVERRIDE:
   - User requested: grok
   - Forced to use: grok-reasoning
   - Reason: Owner-level override: UKidney Medical
```

**Document-Level Override:**
When a document has its own override that differs from owner setting:

```
🔒 FORCED MODEL OVERRIDE:
   - User requested: grok-reasoning
   - Forced to use: grok
   - Reason: Document-level override: maker-special-procedure
```

**Multi-Document Conflict Resolution:**
When querying documents with conflicting overrides:

```
🔒 FORCED MODEL OVERRIDE:
   - User requested: grok
   - Forced to use: grok-reasoning
   - Reason: Multi-document override: conflicting overrides (grok, grok-reasoning)
```

### Performance
- No performance impact - single database query already fetches owner info
- View includes the new column automatically
- No additional database round trips required

## Migrations Applied

1. **`update_chunk_limit_functions.sql`**:
   - Added `forced_grok_model` column to `documents` table
   - Updated `get_documents_with_owner()` function to return both document and owner forced model fields
   - Added hierarchical override logic to both streaming and non-streaming chat routes
   - Implemented multi-document conflict resolution using `grok-reasoning` as safest option

## Testing

### Test Owner-Level Override

1. Set forced model:
```sql
UPDATE owners SET forced_grok_model = 'grok-reasoning' WHERE slug = 'ukidney';
```

2. Make request with `model=grok` for a UKidney document
3. Check server logs for override message
4. Verify conversation metadata shows override

### Test Document-Level Override

1. Set document-specific override:
```sql
UPDATE documents SET forced_grok_model = 'grok' WHERE slug = 'smh';
```

2. Make request with `model=grok-reasoning` for the SMH document
3. Verify it uses `grok` (document override takes precedence)
4. Check console logs show "Document-level override: smh"

### Test Multi-Document Conflict Resolution

1. Set conflicting overrides:
```sql
UPDATE documents SET forced_grok_model = 'grok' WHERE slug = 'doc1';
UPDATE documents SET forced_grok_model = 'grok-reasoning' WHERE slug = 'doc2';
```

2. Query both documents: `?doc=doc1+doc2&model=grok`
3. Verify it uses `grok-reasoning` due to conflict
4. Check logs show "Multi-document override: conflicting overrides"

### Test No Override

1. Ensure no forced models:
```sql
UPDATE owners SET forced_grok_model = NULL WHERE slug = 'default';
UPDATE documents SET forced_grok_model = NULL WHERE slug = 'test-doc';
```

2. Make request with any model
3. Verify user choice is respected

## Future Enhancements

Potential improvements:
- Add UI indicator when model is overridden
- Allow per-document overrides (not just per-owner)
- Add admin dashboard to manage forced models
- Support forcing specific models for other providers (Gemini, etc.)
- Add reasoning/explanation for why a model is forced

