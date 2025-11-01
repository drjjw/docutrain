# Batch Document Training Guide

**Purpose:** Efficiently train multiple documents at once with automated database registration, build script updates, and embedding generation. Includes smart skipping of existing documents to save time and costs.

## Overview

The batch training system automates the entire document training workflow:

1. ✅ Validates all documents and PDFs exist
2. ✅ Adds documents to database registry
3. ✅ Updates build.js with PDF paths
4. ✅ **Optionally skips existing documents** (`--skip-existing` flag)
5. ✅ Trains with OpenAI embeddings
6. ✅ Trains with local embeddings
7. ✅ Generates comprehensive summary report

**Key Feature:** Use `--skip-existing` to avoid retraining documents that are already in your database, saving time and API costs.

## Quick Start

### 1. Create Configuration File

Create a JSON file (e.g., `my-documents.json`) with your documents:

```json
{
  "documents": [
    {
      "slug": "kdigo-ckd-2024",
      "title": "KDIGO CKD Clinical Practice Guideline",
      "subtitle": "2024",
      "year": "2024",
      "backLink": "https://kdigo.org/",
      "welcomeMessage": "KDIGO CKD Clinical Practice Guideline 2024",
      "pdfFilename": "KDIGO-2024-CKD-Guideline.pdf",
      "pdfSubdirectory": "guidelines",
      "embeddingTypes": "both",
      "metadata": {
        "source": "KDIGO",
        "guideline_type": "CKD",
        "version": "2024"
      }
    }
  ]
}
```

### 2. Place PDF Files

Ensure all PDF files are in the correct location:
```
PDFs/
  ├── guidelines/
  │   └── KDIGO-2024-CKD-Guideline.pdf
  └── manuals/
      └── your-manual.pdf
```

### 3. Run Batch Training

```bash
# Train all documents with both embedding types
node scripts/batch-train-documents.js --config=my-documents.json

# Validate only (dry run)
node scripts/batch-train-documents.js --config=my-documents.json --dry-run

# Skip OpenAI embeddings (local only)
node scripts/batch-train-documents.js --config=my-documents.json --skip-openai

# Skip local embeddings (OpenAI only)
node scripts/batch-train-documents.js --config=my-documents.json --skip-local

# Skip existing documents (only train new ones)
node scripts/batch-train-documents.js --config=my-documents.json --skip-existing
```

## Configuration Format

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `slug` | string | URL-friendly identifier | `"kdigo-ckd-2024"` |
| `title` | string | Document title | `"KDIGO CKD Guideline"` |
| `pdfFilename` | string | PDF filename | `"KDIGO-2024-CKD.pdf"` |
| `pdfSubdirectory` | string | Subdirectory in PDFs/ | `"guidelines"` or `"manuals"` |
| `embeddingTypes` | string | Embedding types to use | `"both"`, `"openai"`, or `"local"` |

### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `subtitle` | string | Subtitle/version | `"2024"` |
| `year` | string | Publication year | `"2024"` |
| `backLink` | string | Source URL | `"https://kdigo.org/"` |
| `welcomeMessage` | string | Welcome text | `"KDIGO CKD Guideline 2024"` |
| `metadata` | object | Additional metadata | `{"source": "KDIGO"}` |

### Embedding Types

- **`"both"`** - Trains embeddings in both tables for the same document
  - Creates **one** document entry with primary type `openai`
  - Trains chunks in both `document_chunks` (OpenAI) and `document_chunks_local` (Local)
  - Access via `?doc=your-slug&embedding=openai` or `?doc=your-slug&embedding=local`
- **`"openai"`** - Only OpenAI embeddings (text-embedding-3-small, 1536 dimensions)
  - Single document entry, chunks only in `document_chunks`
- **`"local"`** - Only local embeddings (all-MiniLM-L6-v2, 384 dimensions)
  - Single document entry, chunks only in `document_chunks_local`

## Example Configurations

### Single Document (Both Embedding Types)

```json
{
  "documents": [
    {
      "slug": "kdigo-bp-2021",
      "title": "KDIGO Blood Pressure Clinical Practice Guideline",
      "subtitle": "2021",
      "year": "2021",
      "backLink": "https://kdigo.org/",
      "welcomeMessage": "KDIGO Blood Pressure Clinical Practice Guideline 2021",
      "pdfFilename": "KDIGO-2021-BP-GL.pdf",
      "pdfSubdirectory": "guidelines",
      "embeddingTypes": "both",
      "metadata": {
        "source": "KDIGO",
        "guideline_type": "Blood Pressure"
      }
    }
  ]
}
```

### Multiple Documents (Mixed Types)

```json
{
  "documents": [
    {
      "slug": "kdigo-ckd-2024",
      "title": "KDIGO CKD Guideline",
      "pdfFilename": "KDIGO-2024-CKD.pdf",
      "pdfSubdirectory": "guidelines",
      "embeddingTypes": "both"
    },
    {
      "slug": "hospital-manual",
      "title": "Hospital Nephrology Manual",
      "pdfFilename": "hospital-manual-2024.pdf",
      "pdfSubdirectory": "manuals",
      "embeddingTypes": "local"
    },
    {
      "slug": "research-paper",
      "title": "Important Research Paper",
      "pdfFilename": "research-2024.pdf",
      "pdfSubdirectory": "guidelines",
      "embeddingTypes": "openai"
    }
  ]
}
```

## Command Line Options

### `--config=<file.json>` (Required)
Path to the JSON configuration file containing documents to train.

```bash
node scripts/batch-train-documents.js --config=my-documents.json
```

### `--dry-run`
Validates configuration and checks for PDF files without making any changes.

```bash
node scripts/batch-train-documents.js --config=my-documents.json --dry-run
```

### `--skip-openai`
Skip OpenAI embedding generation (only train local embeddings).

```bash
node scripts/batch-train-documents.js --config=my-documents.json --skip-openai
```

### `--skip-local`
Skip local embedding generation (only train OpenAI embeddings).

```bash
node scripts/batch-train-documents.js --config=my-documents.json --skip-local
```

### `--skip-existing`
Skip documents that already have embeddings in the database. Only trains new documents.

```bash
node scripts/batch-train-documents.js --config=my-documents.json --skip-existing
```

## Workflow Details

### Step 1: Validation
- Checks all required fields are present
- Validates embedding types
- Verifies PDF files exist
- Stops if any validation fails

### Step 2: Database Registration
- Adds documents to `documents` table
- Creates separate entries for each embedding type
- Skips documents that already exist
- Includes all metadata

### Step 3: Build Script Update
- Adds PDF paths to `build.js`
- Ensures PDFs are included in deployment
- Skips if already present

### Step 4: Embedding Training
- Runs chunk-and-embed.js for OpenAI embeddings
- Runs chunk-and-embed-local.js for local embeddings
- Processes each document sequentially
- Continues on failure (doesn't stop entire batch)

### Step 5: Summary Report
- Shows registry updates
- Lists training results
- Reports performance metrics
- Highlights any failures

## Example Output

```
🚀 Batch Document Training Script
======================================================================

📄 Loading configuration from: my-documents.json
✓ Found 3 documents to process

🔍 Validating documents...
  ✓ Document 1: kdigo-ckd-2024
  ✓ Document 2: kdigo-anemia-2012
  ✓ Document 3: hospital-manual

======================================================================
📄 Processing Document 1/3: kdigo-ckd-2024
======================================================================

1️⃣  Adding to database registry...
  ✓ Added kdigo-ckd-2024 to registry (primary: openai)

2️⃣  Updating build.js...
  ✓ Added to build.js: PDFs/guidelines/KDIGO-2024-CKD.pdf

3️⃣  Training embeddings...
  🔄 Training kdigo-ckd-2024 with openai embeddings...
  [... training output ...]
  ✓ Completed kdigo-ckd-2024 (openai) in 145.3s

  🔄 Training kdigo-ckd-2024 with local embeddings...
  [... training output ...]
  ✓ Completed kdigo-ckd-2024 (local) in 28.7s

======================================================================
📊 BATCH TRAINING SUMMARY
======================================================================

📝 Registry Updates:
   ✓ Added: 2 documents
   ⊘ Already existed: 4 documents

🔢 Embedding Training:
   ✓ Successfully trained: 2 documents
   ⊘ Skipped: 4 documents (already exist)

⏱️  Performance:
   Total time: 142.3s
   Average per document: 71.2s

📦 Build Script:
   ✓ Updated: 1 PDFs added

======================================================================
✅ All documents processed successfully!
======================================================================

### Example with --skip-existing flag:

======================================================================
📊 BATCH TRAINING SUMMARY
======================================================================

📝 Registry Updates:
   ✓ Added: 1 documents
   ⊘ Already existed: 5 documents

🔢 Embedding Training:
   ✓ Successfully trained: 1 documents
   ⊘ Skipped: 2 documents (already exist, --skip-existing flag)

⏱️  Performance:
   Total time: 45.2s
   Average per document: 45.2s

📦 Build Script:
   ✓ Updated: 1 PDFs added

======================================================================
✅ All documents processed successfully!
======================================================================
```

## Best Practices

### 1. Start with Dry Run
Always validate your configuration first:
```bash
node scripts/batch-train-documents.js --config=my-docs.json --dry-run
```

### 2. Test with One Document
Before batch processing many documents, test with a single document:
```json
{
  "documents": [
    { /* single document config */ }
  ]
}
```

### 3. Use Consistent Naming
- Guidelines: `kdigo-topic-year`, `asa-topic-year`
- Manuals: `hospital-type-year`, `uhn-dialysis-2024`
- Use same slug for both embedding types (no `-local` suffix needed)

### 4. Organize PDFs First
Ensure all PDFs are in place before running the script:
```
PDFs/
  ├── guidelines/    # Clinical guidelines, research papers
  └── manuals/       # Hospital manuals, protocols
```

### 5. Monitor Progress
The script shows real-time progress. For long-running batches:
- OpenAI embeddings: ~0.5s per chunk
- Local embeddings: ~0.03s per chunk
- Estimate: ~2-3 minutes per 100-page document (both types)

### 6. Handle Failures Gracefully
If some documents fail:
1. Check the error message in the summary
2. Fix the issue (missing PDF, invalid config, etc.)
3. Re-run with only the failed documents
4. Use `--skip-existing` to avoid retraining documents already in the database

### 7. Use --skip-existing for Efficiency
When adding new documents to an existing library:
```bash
# Add new documents to your config file
# Then run with --skip-existing to avoid wasteful retraining
node scripts/batch-train-documents.js --config=my-documents.json --skip-existing
```

**Benefits:**
- ⚡ **Faster processing** - Skips existing documents entirely
- 💰 **Cost savings** - Avoids unnecessary OpenAI API calls
- 🛡️ **Safer** - Prevents interruptions from damaging existing data
- 📊 **Clearer output** - Summary shows only newly trained documents

## Troubleshooting

### "PDF file not found"
- Check the PDF is in `PDFs/<pdfSubdirectory>/<pdfFilename>`
- Verify the filename matches exactly (case-sensitive)
- Ensure the subdirectory is either `guidelines` or `manuals`

### "Document already exists in registry"
- The document slug is already in the database
- Use a different slug or delete the existing document
- The script will skip training if already exists

### "Could not find pdfFiles array in build.js"
- The build.js file structure has changed
- Manually add the PDF path to build.js
- Check that build.js has the `const pdfFiles = [...]` array

### Training Fails
- Check OpenAI API key is valid (for OpenAI embeddings)
- Ensure sufficient API credits
- Verify network connectivity
- Check Supabase credentials

## Performance Tips

### For Large Batches (10+ documents)

1. **Use --skip-existing for incremental updates:**
   ```bash
   # When adding to existing library, skip already trained documents
   node scripts/batch-train-documents.js --config=docs.json --skip-existing
   ```

2. **Skip one embedding type initially:**
   ```bash
   # Train OpenAI first (slower)
   node scripts/batch-train-documents.js --config=docs.json --skip-local --skip-existing

   # Then train local (faster)
   node scripts/batch-train-documents.js --config=docs.json --skip-openai --skip-existing
   ```

3. **Process in smaller batches:**
   - Split your config into multiple files
   - Process 3-5 documents at a time
   - Easier to recover from failures

4. **Use local embeddings for testing:**
   - Much faster (~6x)
   - Good for validating document structure
   - Switch to OpenAI for production

## Integration with Existing Workflow

### Before Batch Training
```bash
# 1. Place PDFs in correct folders
cp ~/Downloads/*.pdf PDFs/guidelines/

# 2. Create configuration file
nano my-documents.json

# 3. Validate
node scripts/batch-train-documents.js --config=my-documents.json --dry-run
```

### After Batch Training
```bash
# 1. Build distribution
node build.js

# 2. Test locally
node server.js

# 3. Deploy
./deploy.sh
```

## Advanced Usage

### Programmatic Usage

You can also use the batch training functions programmatically:

```javascript
const { validateDocumentConfig, addDocumentToRegistry, updateBuildScript } = require('./scripts/batch-train-documents');

// Validate a document config
const doc = {
  slug: 'my-doc',
  title: 'My Document',
  // ... other fields
};

try {
  validateDocumentConfig(doc, 0);
  console.log('Valid!');
} catch (error) {
  console.error('Invalid:', error.message);
}
```

## Comparison: Manual vs Batch Training

| Task | Manual | Batch Script |
|------|--------|--------------|
| Add to database | SQL query per document | Automatic |
| Update build.js | Manual edit | Automatic |
| Train OpenAI | Run script per doc | Automatic |
| Train local | Run script per doc | Automatic |
| Skip existing docs | N/A | `--skip-existing` flag |
| Verify results | Manual checks | Summary report |
| **Time for 5 docs** | ~30 minutes | ~5 minutes + training time |

## See Also

- `chunk-and-embed.js` - OpenAI embedding script
- `chunk-and-embed-local.js` - Local embedding script
- `build.js` - Build script for deployment
- `MISSING-PDF-FIX.md` - Error handling documentation


