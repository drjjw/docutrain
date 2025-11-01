# Multi-Document Citation & Conflict Detection Fix

**Date**: October 19, 2025  
**Status**: ✅ Implemented

## Problem Statement

1. **Citation Format Issue**: When searching multiple documents, AI citations only showed page numbers (e.g., "[1] Page 15") instead of including the source document name
2. **No Conflict Detection**: The system had no explicit instructions to detect or report conflicting information between different documents

## Solution Implemented

Updated the system prompt in `server.js` (function `getRAGSystemPrompt`) to:

### 1. Dynamic Citation Format

**Single Document Searches** (e.g., `?doc=smh`):
- Citations show only page numbers
- Example: `[1] Page 15`

**Multi-Document Searches** (e.g., `?doc=smh+uhn`):
- Citations **MUST** include both document name AND page number
- Example: `[1] SMH Manual, Page 15` and `[2] UHN Manual, Page 42`

### 2. Conflict Detection Instructions

Added explicit instructions for multi-document queries:

```
7. **CRITICAL FOR MULTI-DOCUMENT SEARCHES**: If you notice CONFLICTING 
   or CONTRADICTORY information between the sources:
   - Explicitly state "Different recommendations exist between sources"
   - Present BOTH perspectives with their respective source citations
   - Note which guideline is more recent if applicable
   - Example: "Source A recommends X[1], while Source B suggests Y[2]"
   - Do NOT try to reconcile conflicts - present them transparently
   - If differences are due to context (e.g., different patient populations), 
     explain the distinction
```

## Implementation Details

### Code Changes

**File**: `server.js` and `dist/server.js` (lines ~281-325)

Added logic to detect multi-document queries and customize prompt accordingly:

```javascript
// Determine if this is a multi-document query
const isMultiDoc = docArray.length > 1;

// Build citation format instructions based on single vs multi-doc
const citationFormat = isMultiDoc 
    ? `...For multi-document searches, your references MUST include both 
       the source document name AND page number...`
    : `...For single-document searches, your references should include 
       the page number...`;

// Add conflict detection instructions for multi-document queries
const conflictInstructions = isMultiDoc ? `
7. **CRITICAL FOR MULTI-DOCUMENT SEARCHES**: ...` : '';
```

### What Changed in the Prompt

#### Before
```
***CRITICAL FORMATTING REQUIREMENT: You MUST include footnotes [1], [2], 
etc. for EVERY claim/fact in your response, with references at the end. 
Look for [Page X] markers...
Example: [1] Page 15 [2] Page 45***

IMPORTANT RULES:
1. Answer questions ONLY using information...
2. If the answer is not in the excerpts...
[No conflict detection instructions]
```

#### After
```
***CRITICAL FORMATTING REQUIREMENT: You MUST include footnotes [1], [2], 
etc. for EVERY claim/fact in your response, with references at the end.
[Dynamic citation format based on single/multi-doc]***

IMPORTANT RULES:
1. Answer questions ONLY using information...
2. If the answer is not in the excerpts...
...
7. [Conflict detection instructions - ONLY for multi-doc queries]

FORMATTING RULES:
...
- [Dynamic citation example based on single/multi-doc]
```

## Testing

### Test Case 1: Single Document Query
**URL**: `?doc=smh`  
**Query**: "What is the target blood pressure for CKD?"  
**Expected Citation Format**:
```
Target BP is <130/80[1].

---

**References**
[1] Page 42
```

### Test Case 2: Multi-Document Query
**URL**: `?doc=smh+uhn`  
**Query**: "What is the target blood pressure for CKD?"  
**Expected Citation Format**:
```
Target BP recommendations vary. SMH Manual suggests <130/80[1], 
while UHN Manual recommends <140/90[2].

---

**References**
[1] SMH Manual, Page 42
[2] UHN Manual, Page 67
```

### Test Case 3: Conflict Detection
**URL**: `?doc=kdigo-2012+kdigo-2024`  
**Query**: "What is the classification of CKD stage 3?"  
**Expected Behavior**:
- AI should detect if classifications differ
- Explicitly state "Different recommendations exist between sources"
- Present both versions with citations
- Note which is more recent

## Benefits

1. ✅ **Clear Source Attribution**: Users can immediately see which document each fact comes from
2. ✅ **Conflict Awareness**: Users are explicitly warned when sources disagree
3. ✅ **Maintains Compatibility**: Single-doc queries unchanged (still show "Page X")
4. ✅ **Medical Safety**: Critical for clinical decision support - users need to know if guidelines conflict
5. ✅ **Transparency**: AI doesn't arbitrarily pick one source over another

## Technical Notes

- The system already annotates chunks with `[Source: Document Name]` for multi-doc queries
- The prompt now explicitly instructs the AI to extract and use this information
- Conflict detection is **additive** - it doesn't break single-document searches
- The instructions are conditional - they only appear when `docArray.length > 1`

## Related Files

- `server.js` (line 247-326): System prompt generation
- `dist/server.js` (line 247-326): Production version
- `lib/document-registry.js`: Document metadata and validation
- `public/js/config.js`: Frontend document loading

## Future Enhancements

Consider adding:
- [ ] UI warning when selecting documents with known conflicts
- [ ] Metadata field in database to mark "supersedes" relationships
- [ ] Admin dashboard to track conflict frequency in `chat_conversations`
- [ ] Conflict detection pre-processing (before main AI call)

## Monitoring

Track performance via database queries:

```sql
-- Find multi-doc queries with potential conflicts
SELECT 
    id,
    question,
    response,
    metadata->'document_slugs' as docs
FROM chat_conversations
WHERE metadata->>'is_multi_document' = 'true'
AND (
    response ILIKE '%different recommendations%' 
    OR response ILIKE '%while%'
    OR response ILIKE '%however%'
);
```

## Changelog

**2025-10-19**:
- ✅ Added dynamic citation format (document name + page for multi-doc)
- ✅ Added explicit conflict detection instructions
- ✅ Updated both `server.js` and `dist/server.js`
- ✅ No breaking changes to existing functionality

---

**See Also**:
- [Multi-Document RAG Implementation](./MULTI-DOCUMENT-RAG-IMPLEMENTATION.md)
- [API Reference](./API_REFERENCE.md)
- [Multi-Doc Test Examples](./MULTI-DOC-TEST-EXAMPLES.md)

