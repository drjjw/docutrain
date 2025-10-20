# Multi-Document RAG Search - Test Examples

## Valid Multi-Document Combinations

Based on the current document registry, here are examples of valid multi-document searches:

### Example 1: SMH + UHN Manuals
```
https://ukidney.com/chat?doc=smh+uhn&model=grok
```
- ✅ Both documents: owner=ukidney, embedding=openai
- Returns 5 chunks from SMH Manual + 5 chunks from UHN Manual = 10 total
- Perfect for comparing policies across Toronto nephrology programs

### Example 2: Multiple KDIGO Guidelines
```
https://ukidney.com/chat?doc=kdigo-ckd-2024+kdigo-bp-2021+kdigo-gd-2021
```
- ✅ All documents: owner=ukidney, embedding=openai  
- Returns 15 chunks total (5 from each guideline)
- Great for questions spanning CKD management, BP, and glomerular disease

### Example 3: AJKD Core Curriculum Topics
```
https://ukidney.com/chat?doc=ajkd-cc-anca-associated-vasculitis+ajkd-cc-iga-nephropathy+ajkd-cc-membranous-nephropathy
```
- ✅ All documents: owner=ukidney, embedding=openai
- Returns 15 chunks total
- Perfect for comparing glomerular diseases

### Example 4: Transplant Resources (Local Embeddings)
```
https://ukidney.com/chat?doc=smh-tx+ckd-dc-2025&embedding=local
```
- ✅ Both documents: owner=ukidney, embedding=local
- Returns 10 chunks total
- Note: These use local embeddings, so must specify `&embedding=local`

## Invalid Multi-Document Combinations

These will return helpful error messages:

### Error Example 1: Different Owners
```
https://ukidney.com/chat?doc=smh+maker-foh
```
❌ **Error**: "Cannot combine documents from different owners: ukidney, maker"

### Error Example 2: Different Embedding Types
```
https://ukidney.com/chat?doc=smh+ckd-dc-2025
```
❌ **Error**: "Cannot combine documents with different embedding types: openai, local"

### Error Example 3: Too Many Documents
```
https://ukidney.com/chat?doc=doc1+doc2+doc3+doc4+doc5+doc6
```
❌ **Error**: "Maximum 5 documents can be searched simultaneously. You specified 6."

### Error Example 4: Invalid Document Slug
```
https://ukidney.com/chat?doc=smh+invalid-doc-name
```
❌ **Error**: "The following document(s) are not available: invalid-doc-name"

## Document Categories by Owner & Embedding

### UKidney + OpenAI (Most common - 113 documents)
- Hospital manuals: `smh`, `uhn`, `smh-icu-epic`
- KDIGO guidelines: `kdigo-ckd-2024`, `kdigo-bp-2021`, `kdigo-gd-2021`, etc.
- AJKD Core Curriculum: 100+ articles
- Textbook: `kk` (Kamel & Halperin)

### UKidney + Local (2 documents)
- `smh-tx` (SMH Transplant Manual)
- `ckd-dc-2025` (Diabetes Canada CKD Guideline)

### Maker + OpenAI (1 document)
- `maker-foh` (Front of House Training Guide)

## Recommended Test Queries

1. **Clinical Question Across Manuals**:
   ```
   ?doc=smh+uhn
   Question: "What are the indications for urgent dialysis?"
   ```
   Expected: Policies from both SMH and UHN combined

2. **Guideline Comparison**:
   ```
   ?doc=kdigo-ckd-2024+kdigo-bp-2021
   Question: "What are the blood pressure targets for patients with CKD stage 3?"
   ```
   Expected: Recommendations from both guidelines

3. **Disease Topic Comparison**:
   ```
   ?doc=ajkd-cc-anca-associated-vasculitis+ajkd-cc-iga-nephropathy
   Question: "Compare the treatment approaches for ANCA vasculitis and IgA nephropathy"
   ```
   Expected: Side-by-side information from both articles

4. **Local Embeddings Test**:
   ```
   ?doc=smh-tx+ckd-dc-2025&embedding=local
   Question: "How should diabetes be managed in kidney transplant recipients?"
   ```
   Expected: Combined guidance from transplant manual and diabetes guideline

## Performance Expectations

| Documents | Expected Query Time | Chunks Returned |
|-----------|-------------------|----------------|
| 1 doc     | 200-300ms        | 5 chunks       |
| 2 docs    | 400-600ms        | 10 chunks      |
| 3 docs    | 600-900ms        | 15 chunks      |
| 5 docs    | 1000-1500ms      | 25 chunks      |

## Verification Checklist

- [ ] Single-document query still works: `?doc=smh`
- [ ] Two-document query works: `?doc=smh+uhn`
- [ ] Owner validation blocks: `?doc=smh+maker-foh`
- [ ] Embedding validation blocks: `?doc=smh+ckd-dc-2025`
- [ ] Document limit enforced: Try 6+ documents
- [ ] Response shows "Multi-document search" in subtitle
- [ ] Metadata includes `isMultiDocument: true`
- [ ] Logging shows combined document names

## Implementation Status

✅ Database functions created
✅ Backend validation implemented
✅ Frontend parsing implemented
✅ UI updated for multi-document display
✅ Response metadata includes source attribution
✅ Changes copied to dist folder

## Next Steps

Ready for testing! Try the examples above to verify the feature works as expected.

