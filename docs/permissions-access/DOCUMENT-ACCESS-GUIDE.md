# Document Access Guide

## URL Structure

### Basic Format
```
http://localhost:3456/?doc=<slug>&embedding=<type>&method=<mode>
```

### Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `doc` | Any valid slug | `smh` | Document to load |
| `embedding` | `openai`, `local` | `openai` | Embedding type to use |
| `method` | `rag`, `full` | `rag` | Search mode |
| `model` | `gemini`, `grok`, `grok-reasoning` | `grok` | AI model |

## Embedding Types

### OpenAI Embeddings (Default)
- **Model:** text-embedding-3-small
- **Dimensions:** 1536
- **Speed:** Slower (~2-3s per query)
- **Quality:** Higher accuracy
- **Cost:** API calls required

**Access:**
```
?doc=kdigo-ckd-2024
?doc=kdigo-ckd-2024&embedding=openai
```

### Local Embeddings
- **Model:** all-MiniLM-L6-v2
- **Dimensions:** 384
- **Speed:** 6-8x faster (~300ms per query)
- **Quality:** Good for most queries
- **Cost:** Free (runs locally)

**Access:**
```
?doc=kdigo-ckd-2024&embedding=local
```

## Document Slugs

### Available Documents

| Slug | Title | Year | Primary Type |
|------|-------|------|--------------|
| `smh` | Nephrology Manual (SMH) | 2023 | openai |
| `uhn` | Nephrology Manual (UHN) | 2025 | openai |
| `ckd-dc-2025` | CKD in Diabetes Guidelines | 2025 | local |
| `smh-tx` | SMH Renal Transplant Manual | 2024 | local |
| `kdigo-adpkd-2025` | KDIGO ADPKD Guideline | 2025 | openai |
| `kdigo-bp-2021` | KDIGO Blood Pressure Guideline | 2021 | openai |
| `kdigo-anca-2024` | KDIGO ANCA Vasculitis Guideline | 2024 | openai |
| `kdigo-ckd-2024` | KDIGO CKD Guideline | 2024 | openai |
| `kdigo-igan-2025` | KDIGO IgAN/IgAV Guideline | 2025 | openai |

**Note:** "Primary Type" is the default, but all KDIGO documents support both embedding types.

## Example URLs

### KDIGO CKD 2024 Guideline

**OpenAI (default):**
```
http://localhost:3456/?doc=kdigo-ckd-2024
```

**Local embeddings:**
```
http://localhost:3456/?doc=kdigo-ckd-2024&embedding=local
```

**Full document mode:**
```
http://localhost:3456/?doc=kdigo-ckd-2024&method=full
```

**With specific model:**
```
http://localhost:3456/?doc=kdigo-ckd-2024&model=grok-reasoning
```

**All parameters:**
```
http://localhost:3456/?doc=kdigo-ckd-2024&embedding=local&method=rag&model=grok
```

### KDIGO IgAN 2025 Guideline

**OpenAI:**
```
http://localhost:3456/?doc=kdigo-igan-2025
```

**Local:**
```
http://localhost:3456/?doc=kdigo-igan-2025&embedding=local
```

### SMH Manual

**OpenAI (default):**
```
http://localhost:3456/?doc=smh
http://localhost:3456/
```

**Local (override):**
```
http://localhost:3456/?doc=smh&embedding=local
```

## Common Patterns

### Compare Embedding Types

Test the same query with both embedding types:

**OpenAI:**
```
?doc=kdigo-ckd-2024&embedding=openai
```

**Local:**
```
?doc=kdigo-ckd-2024&embedding=local
```

### Switch Documents

Keep same settings, change document:
```
?doc=kdigo-ckd-2024&embedding=local&model=grok
?doc=kdigo-igan-2025&embedding=local&model=grok
```

### Development Testing

Use local embeddings for faster iteration:
```
?doc=your-test-doc&embedding=local&method=rag
```

## Important Notes

### ❌ WRONG: Using `-local` Suffix

**Don't do this:**
```
?doc=kdigo-ckd-2024-local  ❌
```

This was the old approach and is no longer supported.

### ✅ CORRECT: Using `?embedding=` Parameter

**Do this instead:**
```
?doc=kdigo-ckd-2024&embedding=local  ✅
```

### Browser Cache

After adding new documents, you must:

1. **Clear localStorage:**
   - Open DevTools (F12)
   - Go to Application → Local Storage
   - Delete `ukidney-documents-cache` key
   - Refresh page

2. **Or hard refresh:**
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + R`

3. **Or wait 5 minutes** for cache to expire

### Document Availability

A document must have:
- ✅ Entry in `documents` table
- ✅ Chunks in appropriate table(s):
  - `document_chunks` for OpenAI
  - `document_chunks_local` for Local
- ✅ PDF file accessible to server

Check availability:
```bash
# API endpoint
curl http://localhost:3456/api/documents

# Server log
tail -f server.log | grep "Loaded documents"
```

## Troubleshooting

### Document Not Loading

**Symptom:** URL with `?doc=slug` loads default (SMH) instead

**Causes:**
1. Browser cache has old document list
2. Document not in database
3. Server not restarted after adding document

**Solutions:**
1. Clear localStorage (`ukidney-documents-cache`)
2. Verify in database: `SELECT slug FROM documents WHERE slug = 'your-slug'`
3. Restart server: `kill <PID> && node server.js &`

### Wrong Embedding Type

**Symptom:** Query returns "no results" or wrong results

**Causes:**
1. Chunks not trained for that embedding type
2. Wrong parameter value

**Solutions:**
1. Check chunks exist:
   ```sql
   SELECT COUNT(*) FROM document_chunks WHERE document_slug = 'slug';
   SELECT COUNT(*) FROM document_chunks_local WHERE document_slug = 'slug';
   ```
2. Verify parameter: `?embedding=local` (not `?embeddings=local`)

### Slow Performance

**Symptom:** Queries take 2-3 seconds

**Solution:** Use local embeddings for 6-8x speedup:
```
?doc=your-slug&embedding=local
```

## API Endpoints

### List Documents
```bash
curl http://localhost:3456/api/documents
```

Returns:
```json
{
  "documents": [
    {
      "slug": "kdigo-ckd-2024",
      "title": "KDIGO CKD Guideline",
      "embeddingType": "openai",
      "active": true
    }
  ]
}
```

### Health Check
```bash
curl http://localhost:3456/api/health
```

### RAG Query
```bash
curl -X POST http://localhost:3456/api/rag?embedding=local \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the definition of CKD?",
    "doc": "kdigo-ckd-2024",
    "model": "grok"
  }'
```

## Related Documentation

- [Batch Training Guide](BATCH-TRAINING-GUIDE.md) - How to add new documents
- [Embedding Parameter Fix](EMBEDDING-PARAMETER-FIX.md) - Migration from `-local` suffix
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues and solutions
- [URL Parameters](URL-PARAMETERS.md) - Detailed parameter documentation

---

**Last Updated:** October 18, 2025  
**Version:** 2.0 (Post embedding parameter fix)

