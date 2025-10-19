# Multi-Document Conflict Handling

## Current Implementation Analysis

### How Multi-Doc Search Works

When searching across multiple documents (e.g., `?doc=smh+uhn`), the system:

1. **Retrieves relevant chunks** from all specified documents (5 chunks total by default)
2. **Annotates chunks** with source information:
   - Page numbers: `[Page 15]`
   - Source document: `[Source: SMH Nephrology Manual]` (only in multi-doc mode)
3. **Passes all chunks** to the AI model with instructions to cite sources

### Current System Prompt Instructions

From `server.js:247-309`, the AI receives these instructions:

#### What It Does Well ✅
- Informs the AI it's working with "multiple documents: [Doc A] and [Doc B]"
- Requires footnotes `[1], [2]` for every claim with references
- Provides source attribution in the chunk text: `[Source: Document Name]`
- Instructs AI to extract page numbers from `[Page X]` markers

#### What's Missing ⚠️
The current prompt **does NOT** explicitly instruct the AI to:
- Identify contradictions or conflicts between sources
- Compare information across documents
- Highlight when different sources disagree
- Explain which source is more authoritative or recent

### Example Current Prompt (Simplified)

```
You are a helpful assistant that answers questions based on 
multiple documents: SMH Manual and UHN Manual.

IMPORTANT RULES:
1. Answer questions ONLY using information from the provided excerpts
2. If unsure, admit it rather than guessing
3. Do NOT mention chunk numbers
4. Use footnotes [1], [2] for EVERY claim with references at end

RELEVANT EXCERPTS:
---
[Chunk 1 content] [Page 15] [Source: SMH Manual]
[Chunk 2 content] [Page 42] [Source: UHN Manual]
---
```

## Will the AI Detect Conflicts?

### Short Answer
**Maybe, but not reliably** - it depends on:

1. ✅ **If conflicting chunks are both retrieved** (within top 5 results)
2. ✅ **AI model's inherent reasoning ability** (Grok-4, Gemini 2.5)
3. ❌ **No explicit instructions to look for conflicts**
4. ❌ **No training on how to handle medical guideline conflicts**

### Scenarios

#### Scenario 1: Both Conflicting Chunks Retrieved
**Likely to detect**: If the embedding search returns both conflicting pieces of information in the top 5 chunks, modern LLMs (Gemini 2.5, Grok-4) will often notice the contradiction naturally.

**Example**:
```
User: "What's the target blood pressure for CKD patients?"

Retrieved chunks:
1. [Source: 2024 Guidelines] Target BP is <130/80 [Page 15]
2. [Source: 2020 Guidelines] Target BP is <140/90 [Page 42]

AI Response (likely):
"Target blood pressure recommendations have evolved. The 2024 
Guidelines recommend <130/80[1], while the 2020 Guidelines 
suggested <140/90[2]."
```

#### Scenario 2: Only One Chunk Retrieved
**Won't detect**: If semantic search only retrieves one perspective (e.g., only the 2024 guideline), the AI won't know a conflict exists.

#### Scenario 3: Subtle Conflicts
**Less likely to detect**: If information conflicts subtly (different classification schemes, terminology differences), the AI may not recognize it as a conflict without explicit instructions.

## Recommendations for Improvement

### Option 1: Enhanced Conflict Detection Prompt 🎯 (Recommended)

Add explicit conflict detection instructions to the system prompt:

```javascript
const getRAGSystemPrompt = async (documentTypes = 'smh', chunks = []) => {
    // ... existing code ...
    
    const conflictInstructions = docArray.length > 1 ? `

MULTI-DOCUMENT CONFLICT HANDLING:
- If you notice CONFLICTING or CONTRADICTORY information between sources:
  * Explicitly state "There are different recommendations between sources"
  * Present BOTH perspectives with clear source attribution
  * If dates/years are available, note which guideline is more recent
  * Example: "Source A recommends X[1], while Source B suggests Y[2]"
- Do NOT try to reconcile conflicts - present them transparently
- If information differs due to context (e.g., different patient populations), explain the distinction
` : '';

    return `You are a helpful assistant that answers questions based on ${docArray.length > 1 ? 'multiple documents: ' + docName : 'the ' + docName}.

***CRITICAL FORMATTING REQUIREMENT: You MUST include footnotes [1], [2], etc. for EVERY claim/fact in your response...***

IMPORTANT RULES:
1. Answer questions ONLY using information from the provided relevant excerpts below
2. If the answer is not in the excerpts, say "I don't have that information..."
3. Be concise and professional
4. If you're unsure, admit it rather than guessing
5. Do NOT mention chunk numbers or reference which excerpt information came from
${conflictInstructions}

FORMATTING RULES:
...
`;
};
```

### Option 2: Conflict Detection Post-Processing

Add a second AI pass that analyzes the chunks for conflicts BEFORE generating the response:

```javascript
async function detectConflicts(chunks, query) {
    if (chunks.length < 2) return null;
    
    const conflictCheckPrompt = `
    Given these excerpts from different sources about "${query}", 
    are there any contradictions or conflicting recommendations?
    
    Respond with JSON:
    {
        "hasConflict": true/false,
        "conflictDescription": "brief description if conflict exists"
    }
    
    Excerpts:
    ${chunks.map((c, i) => `[${i+1}] ${c.content} [Source: ${c.document_name}]`).join('\n\n')}
    `;
    
    // Call LLM to detect conflicts
    // Return conflict metadata
}
```

### Option 3: Source Ranking/Prioritization

For medical documents with publication years, prioritize more recent sources:

```javascript
// In chunk retrieval, add recency scoring
const rankedChunks = chunks
    .map(chunk => ({
        ...chunk,
        recencyScore: chunk.document_year ? (2025 - chunk.document_year) : 0,
        finalScore: chunk.similarity - (0.01 * (2025 - chunk.document_year))
    }))
    .sort((a, b) => b.finalScore - a.finalScore);
```

Then update prompt:
```
Note: When information differs, prioritize more recent guidelines unless 
specifically asked about historical recommendations.
```

### Option 4: Document Relationship Metadata

Add metadata to the `documents` table to define relationships:

```sql
ALTER TABLE documents ADD COLUMN supersedes_slug TEXT;
ALTER TABLE documents ADD COLUMN superseded_by_slug TEXT;

-- Example: 
UPDATE documents SET superseded_by_slug = 'kdigo-ckd-2024' 
WHERE slug = 'kdigo-ckd-2012';
```

Then in the prompt:
```
Note: [Document A] is superseded by [Document B] (more recent version)
```

## Testing Conflict Detection

### Test Cases to Implement

1. **Obvious Conflict - Different Values**
   - Doc A: "Target BP is <130/80"
   - Doc B: "Target BP is <140/90"
   - Expected: AI explicitly states the conflict

2. **Subtle Conflict - Classification Differences**
   - Doc A: "CKD Stage 3 is GFR 30-59"
   - Doc B: "CKD Stage 3a is GFR 45-59, Stage 3b is GFR 30-44"
   - Expected: AI explains both classification schemes

3. **Contextual Difference - Not Actually a Conflict**
   - Doc A: "Use Drug X in transplant patients"
   - Doc B: "Avoid Drug X in CKD patients"
   - Expected: AI recognizes different patient populations

4. **Temporal Conflict**
   - Doc A (2020): "Recommendation X"
   - Doc B (2024): "Updated recommendation Y"
   - Expected: AI notes guideline evolution

### Evaluation Script

```javascript
// scripts/test-conflict-detection.js
const testCases = [
    {
        query: "What is the target blood pressure for CKD patients?",
        expectedBehavior: "should mention both sources if conflicting",
        documents: ['guideline-2020', 'guideline-2024']
    },
    // ... more test cases
];

// Run queries and check if response contains conflict indicators:
// - "different", "varies", "however", "while Source X"
// - Multiple citations for the same claim
// - Explicit mention of both document sources
```

## Implementation Priority

### Phase 1: Immediate (Low Effort, High Impact)
- [x] Current implementation (source attribution exists)
- [ ] Add explicit conflict detection instructions to prompt (Option 1)
- [ ] Test with known conflicting documents

### Phase 2: Near-term (Medium Effort)
- [ ] Add recency/year-based prioritization (Option 3)
- [ ] Create test suite for conflict detection
- [ ] Monitor chat_conversations metadata for multi-doc queries

### Phase 3: Long-term (Higher Effort)
- [ ] Implement document relationship metadata (Option 4)
- [ ] Consider conflict pre-detection pass (Option 2)
- [ ] Add UI indicators when searching across potentially conflicting sources

## Related Considerations

### 1. User Experience
Should the UI warn users when selecting potentially conflicting documents?

Example:
```
⚠️ You're searching across guidelines from different years (2020, 2024). 
Recommendations may differ. The AI will cite sources for each claim.
```

### 2. Document Combinations
Some combinations are more likely to have conflicts:
- **High conflict risk**: Same guideline, different years (KDIGO 2012 vs 2024)
- **Medium risk**: Different organizations, same topic (KDIGO vs KDOQI)
- **Low risk**: Different topics (CKD guidelines vs transplant manual)

### 3. Medical/Legal Implications
For medical content, explicitly noting conflicts is crucial:
- Protects users from outdated information
- Ensures transparency in clinical decision support
- Reduces liability for contradictory recommendations

## Monitoring & Analytics

Track conflict detection performance via `chat_conversations` metadata:

```sql
-- Find multi-doc queries
SELECT 
    question,
    response,
    metadata->'document_slugs' as docs,
    metadata->'chunk_sources' as sources
FROM chat_conversations
WHERE metadata->>'is_multi_document' = 'true'
AND response ILIKE '%different%' 
   OR response ILIKE '%however%'
   OR response ILIKE '%while%';
```

## Conclusion

**Current Status**: ⚠️ Conflict detection is **incidental, not systematic**

The AI might notice conflicts due to its inherent reasoning ability, but:
- No explicit instructions to look for conflicts
- Success depends on retrieval quality (getting both chunks)
- No guarantees for subtle or complex conflicts

**Recommended Action**: Implement **Option 1** (enhanced prompt) immediately. It's low-effort, high-impact, and makes conflict detection explicit and reliable.

---

**Related Documents**:
- [Multi-Document RAG Implementation](./MULTI-DOCUMENT-RAG-IMPLEMENTATION.md)
- [API Reference](./API_REFERENCE.md)
- [URL Parameters](./URL-PARAMETERS.md)

**Last Updated**: October 19, 2025

