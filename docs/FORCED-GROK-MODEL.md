# Forced Grok Model Feature

## Overview

The `forced_grok_model` column in the `owners` table allows you to enforce specific Grok model variants (reasoning vs. non-reasoning) for documents belonging to each owner. This is a safety mechanism that overrides user model selection.

## Database Schema

### New Column: `owners.forced_grok_model`

- **Type**: `text`
- **Nullable**: Yes (NULL means no override)
- **Allowed Values**: 
  - `'grok'` - Standard Grok model (`grok-4-fast-non-reasoning`)
  - `'grok-reasoning'` - Reasoning Grok model (`grok-4-fast-reasoning`)
  - `NULL` - No override (user choice respected)
- **Constraint**: `CHECK (forced_grok_model IS NULL OR forced_grok_model IN ('grok', 'grok-reasoning'))`

## How It Works

1. **User Makes Request**: User selects a model (e.g., `grok` or `grok-reasoning`)
2. **Owner Check**: Server fetches the document's owner information including `forced_grok_model`
3. **Override Logic**: 
   - If `forced_grok_model` is set AND user selected a Grok variant → Override applied
   - If `forced_grok_model` is NULL → User choice respected
   - If user selected Gemini → No override (only applies to Grok models)
4. **Logging**: Override is logged in conversation metadata for audit purposes

## Use Cases

### Medical Documents (UKidney)
Medical nephrology documents require comprehensive reasoning and careful analysis. Force the reasoning model:

```sql
UPDATE owners 
SET forced_grok_model = 'grok-reasoning',
    updated_at = now()
WHERE slug = 'ukidney';
```

### Training Documents (Maker Pizza)
Restaurant training documents may benefit from faster responses without deep reasoning:

```sql
UPDATE owners 
SET forced_grok_model = 'grok',
    updated_at = now()
WHERE slug = 'maker-pizza';
```

### Default/General Documents
No override - let users choose:

```sql
UPDATE owners 
SET forced_grok_model = NULL,
    updated_at = now()
WHERE slug = 'default';
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
    created_at
FROM chat_conversations
WHERE metadata->>'model_override_applied' = 'true'
ORDER BY created_at DESC
LIMIT 20;
```

### Statistics by Owner

```sql
-- Count overrides by owner
SELECT 
    metadata->>'owner_name' as owner,
    metadata->>'forced_grok_model' as forced_model,
    COUNT(*) as override_count
FROM chat_conversations
WHERE metadata->>'model_override_applied' = 'true'
GROUP BY metadata->>'owner_name', metadata->>'forced_grok_model'
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

#### Console Output Example

When a user selects `grok` for a UKidney document, the console will show:

```
📋 URL Parameters Applied:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Document:        uhn
  Validated as:    uhn
  Multi-document:  No
  Model:           grok
  Mode:            RAG-only (database retrieval)
  Embedding Type:  openai (1536D)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[After response received]

🔒 MODEL OVERRIDE DETECTED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Requested:  grok (grok-4-fast-non-reasoning)
  Actually used: grok-4-fast-reasoning
  Reason: Owner-configured safety mechanism
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Performance
- No performance impact - single database query already fetches owner info
- View includes the new column automatically
- No additional database round trips required

## Migrations Applied

1. **`add_forced_grok_model_to_owners`**: Added column to owners table
2. **`recreate_documents_with_owner_view_with_forced_grok`**: Updated view to include new column

## Testing

### Test Override for UKidney Documents

1. Set forced model:
```sql
UPDATE owners SET forced_grok_model = 'grok-reasoning' WHERE slug = 'ukidney';
```

2. Make request with `model=grok` for a UKidney document
3. Check server logs for override message
4. Verify conversation metadata shows override

### Test No Override for Default Owner

1. Ensure no forced model:
```sql
UPDATE owners SET forced_grok_model = NULL WHERE slug = 'default';
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

