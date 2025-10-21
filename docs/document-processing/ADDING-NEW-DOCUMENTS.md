# Adding New Documents to the RAG System

## 🎯 Quick Start

### Prerequisites
- PDF file ready
- Document slug chosen (lowercase, hyphens, no spaces)
- Owner determined (e.g., 'ukidney', 'ajkd', 'kdigo')
- Supabase connection configured

### Basic Workflow

```bash
# 1. Place PDF in appropriate directory
cp your-document.pdf PDFs/manuals/

# 2. Add to document registry (if not already there)
# This is usually done via batch-train-documents.js or manually in Supabase

# 3. Process with OpenAI embeddings
node scripts/chunk-and-embed.js --doc=your-doc-slug

# 4. Process with local embeddings
node scripts/chunk-and-embed-local.js --doc=your-doc-slug

# 5. Verify in the UI
# Navigate to http://localhost:3456/?doc=your-doc-slug
```

## 📁 Directory Structure

Place PDFs in the appropriate directory:

```
PDFs/
├── manuals/          # Clinical manuals (SMH, UHN, etc.)
├── guidelines/       # KDIGO guidelines
├── ajkd-core-curriculum/  # AJKD Core Curriculum papers
├── books/            # Textbooks
├── slides/           # Presentation slides
└── maker/            # Non-medical (example: restaurant training)
```

## 📝 Step-by-Step Guide

### Step 1: Prepare the PDF

1. **Check PDF Quality**
   - Text-based PDF (not scanned images)
   - Reasonable file size (< 50MB recommended)
   - No password protection

2. **Choose a Slug**
   - Lowercase only
   - Use hyphens, not underscores or spaces
   - Descriptive but concise
   - Examples:
     - `smh` (SMH Nephrology Manual)
     - `kdigo-ckd-2024` (KDIGO CKD Guideline 2024)
     - `ajkd-cc-iga-nephropathy` (AJKD Core Curriculum - IgA Nephropathy)

3. **Place PDF in Directory**
   ```bash
   cp your-document.pdf PDFs/manuals/your-document.pdf
   ```

### Step 2: Add to Document Registry

#### Option A: Using batch-train-documents.js (Recommended)

1. Create a JSON config file:
   ```json
   {
     "slug": "your-doc-slug",
     "name": "Your Document Display Name",
     "owner": "ukidney",
     "embedding_type": "openai",
     "file_path": "PDFs/manuals/your-document.pdf"
   }
   ```

2. Run batch training:
   ```bash
   node scripts/batch-train-documents.js
   ```

#### Option B: Manual Database Entry

1. Connect to Supabase
2. Insert into `document_registry`:
   ```sql
   INSERT INTO document_registry (
     slug,
     name,
     owner,
     embedding_type,
     file_path,
     is_active
   ) VALUES (
     'your-doc-slug',
     'Your Document Display Name',
     'ukidney',
     'openai',
     'PDFs/manuals/your-document.pdf',
     true
   );
   ```

#### Option C: Direct Script Execution

If document is already in registry, skip to Step 3.

### Step 3: Process with OpenAI Embeddings

```bash
node scripts/chunk-and-embed.js --doc=your-doc-slug
```

**What you'll see**:
```
🚀 PDF Chunking & Embedding Script (OpenAI)
============================================================
✓ Environment variables loaded
✓ Target database: https://mlxctdgnojvkgfqldaob.supabase.co
✓ Using OpenAI text-embedding-3-small (1536 dimensions)

📚 Loading document registry from database...
✓ Loaded 123 active documents from registry

📝 Processing single document: your-doc-slug
============================================================
📄 Processing: Your Document Display Name
   Slug: your-doc-slug
============================================================

🗑️  Deleting existing chunks...
✓ Existing chunks deleted

📖 Loading PDF...
   Adding 42 page markers to text...  ← Automatic page detection!
  ✓ Loaded 42 pages
  ✓ Total characters: 125,450

✂️  Chunking text...
  ✓ Created 78 chunks
  ✓ Chunk size: ~500 tokens (2000 chars)
  ✓ Overlap: ~100 tokens (400 chars)
  ✓ Page detection: using 42 total pages

🔢 Generating embeddings with OpenAI...
  Processing in batches of 50
  Batch 1/2: ..................................................
  Batch 2/2: ............................
  ✓ Generated 78/78 embeddings successfully

💾 Storing in Supabase...
  💾 Inserted 78/78 chunks
✅ Completed in 32.5s
  📊 Final stats:
     - Chunks processed: 78
     - Embeddings generated: 78
     - Records stored: 78

🔍 Running page number validation...
✅ your-doc-slug: 38 unique pages across 78 chunks  ← Validation!

============================================================
🎉 Processed 1 document(s) successfully!
============================================================
```

**Key things to check**:
- ✅ Page markers added automatically
- ✅ Reasonable number of chunks (varies by document size)
- ✅ Validation shows multiple unique pages (not just 1)
- ✅ No errors during embedding generation

### Step 4: Process with Local Embeddings

```bash
node scripts/chunk-and-embed-local.js --doc=your-doc-slug
```

**What you'll see**:
```
🚀 PDF Chunking & Embedding Script (Local)
============================================================
✓ Environment variables loaded
✓ Target database: https://mlxctdgnojvkgfqldaob.supabase.co
✓ Using local all-MiniLM-L6-v2 (384 dimensions)

📝 Processing single document: your-doc-slug
============================================================
📄 Processing: Your Document Display Name
   Slug: your-doc-slug
============================================================

🗑️  Deleting existing chunks...
✓ Existing chunks deleted

📖 Loading PDF...
   Adding 42 page markers to text...
  ✓ Loaded 42 pages
  ✓ Total characters: 125,450

✂️  Chunking text...
  ✓ Created 78 chunks

🔢 Generating embeddings with local all-MiniLM-L6-v2...
  Processing in batches of 50
  Batch 1/2: Local embedding generated in 45ms (384 dimensions)
  [Progress dots...]
  ✓ Generated 78/78 embeddings successfully

💾 Storing in Supabase...
  💾 Inserted 78/78 chunks
✅ Completed in 8.2s  ← Much faster than OpenAI!

🔍 Running page number validation...
✅ your-doc-slug: 38 unique pages across 78 chunks

============================================================
🎉 Processed 1 document(s) successfully!
============================================================
```

**Note**: Local embeddings are much faster (no API calls) but slightly less accurate than OpenAI embeddings.

### Step 5: Update build.js

Add your document to the document selector:

```javascript
// In build.js, add to the documents array
const documents = [
  // ... existing documents ...
  { 
    slug: 'your-doc-slug', 
    name: 'Your Document Display Name', 
    owner: 'ukidney' 
  }
];
```

Then rebuild:
```bash
npm run build
```

### Step 6: Test the Document

1. **Start the server** (if not running):
   ```bash
   npm start
   ```

2. **Navigate to the document**:
   ```
   http://localhost:3456/?doc=your-doc-slug
   ```

3. **Test a query**:
   - Ask a question you know the document should answer
   - Check that the response includes page citations
   - Verify page numbers are diverse (not all "Page 1")

4. **Verify page citations**:
   - Open the PDF
   - Check if cited pages actually contain the referenced information
   - Page numbers should be reasonably accurate

## 🔄 Batch Processing Multiple Documents

If you have multiple documents to add:

```bash
# Create a list of slugs
./scripts/batch-train.sh openai doc1-slug doc2-slug doc3-slug

# Then process with local embeddings
./scripts/batch-train.sh local doc1-slug doc2-slug doc3-slug
```

**Example**:
```bash
./scripts/batch-train.sh openai \
  kdigo-ckd-2024 \
  kdigo-igan-2025 \
  kdigo-adpkd-2025

./scripts/batch-train.sh local \
  kdigo-ckd-2024 \
  kdigo-igan-2025 \
  kdigo-adpkd-2025
```

## ⚠️ Common Issues

### Issue 1: "Document not found in registry"

**Solution**: Add document to `document_registry` table first (see Step 2).

### Issue 2: "Only 1 unique page number"

**Cause**: Page detection may have failed for this specific PDF format.

**Solution**:
1. Check if PDF is scanned images (not text-based)
2. Try opening PDF and verifying page count
3. Test a search query - page numbers may still be reasonable
4. If needed, manually inspect chunks in database

### Issue 3: "OpenAI API rate limit"

**Cause**: Processing too many documents too quickly.

**Solution**:
1. Wait a few minutes and retry
2. Process documents in smaller batches
3. Use local embeddings (no rate limits)

### Issue 4: "Database timeout"

**Cause**: Large document with many chunks.

**Solution**:
1. Retry the document (usually works on second attempt)
2. Check Supabase connection
3. Consider increasing chunk size for very large documents

### Issue 5: "PDF parse error"

**Cause**: PDF is password-protected, corrupted, or unusual format.

**Solution**:
1. Try opening PDF in a PDF reader to verify it's valid
2. Remove password protection if present
3. Re-download PDF if corrupted
4. Convert scanned PDFs to text-based PDFs using OCR

## 📊 Validation Checklist

After processing, verify:

- [ ] Document appears in UI document selector
- [ ] Search queries return relevant results
- [ ] Page citations are present in responses
- [ ] Page numbers are diverse (not all "Page 1")
- [ ] Spot-check: cited pages contain referenced information
- [ ] Both OpenAI and local embeddings processed
- [ ] No errors in processing logs

## 🎯 Best Practices

1. **Always process both embedding types**
   - OpenAI: Better accuracy, slower, costs money
   - Local: Faster, free, slightly less accurate
   - Having both provides flexibility

2. **Check validation output**
   - Look for warnings about page detection
   - Verify unique page count makes sense
   - Test search if warnings appear

3. **Use descriptive slugs**
   - Include document type/category
   - Include year if relevant
   - Keep consistent naming convention

4. **Test before deploying**
   - Always test locally first
   - Verify page citations work
   - Check response quality

5. **Document in registry**
   - Include proper display name
   - Set correct owner
   - Mark as active

## 🔍 Verification Queries

### Check chunks in database:

```sql
-- Count chunks
SELECT COUNT(*) 
FROM document_chunks 
WHERE document_slug = 'your-doc-slug';

-- Check page distribution
SELECT 
    metadata->>'page_number' as page, 
    COUNT(*) as chunks 
FROM document_chunks 
WHERE document_slug = 'your-doc-slug' 
GROUP BY metadata->>'page_number' 
ORDER BY (metadata->>'page_number')::int;

-- Sample chunk content
SELECT 
    metadata->>'page_number' as page,
    LEFT(content, 100) as preview
FROM document_chunks 
WHERE document_slug = 'your-doc-slug'
LIMIT 5;
```

## 📚 Related Documentation

- [PAGE-NUMBER-SYSTEM.md](./PAGE-NUMBER-SYSTEM.md) - How page detection works
- [BATCH-PROCESSING.md](./BATCH-PROCESSING.md) - Processing multiple documents
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions
- [TECHNICAL-ARCHITECTURE.md](./TECHNICAL-ARCHITECTURE.md) - System internals

