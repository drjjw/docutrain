# AI Abstract Generation Feature

## Overview

This feature automatically generates a 100-word abstract for user-uploaded documents using OpenAI's GPT-4o-mini model. The abstract is created from the document's chunks and displayed in the `intro_message` field when users interact with the document.

## Implementation

### 1. Test Script (`scripts/chunk-and-embed-with-abstract-test.js`)

A standalone test script that:
- Loads a PDF document
- Chunks it (500 tokens with 100 token overlap)
- Generates a 100-word abstract using GPT-4o-mini
- **Does NOT store anything in the database** (test mode only)

**Usage:**
```bash
node scripts/chunk-and-embed-with-abstract-test.js "/path/to/document.pdf"
```

**Example:**
```bash
node scripts/chunk-and-embed-with-abstract-test.js "/Users/jordanweinstein/GitHub/chat/PDFs/guidelines/KPD - Protocol for Participating Donors 2019_61 012 v4.pdf"
```

### 2. Production Integration (`lib/document-processor.js`)

The abstract generation is now integrated into the user document upload pipeline:

**Processing Flow:**
1. Download PDF from storage
2. Extract text with page markers
3. **Chunk text** (500 tokens, 100 overlap)
4. **Generate AI abstract** from first 30 chunks
5. Create document record with abstract in `intro_message`
6. Generate embeddings
7. Store chunks in database
8. Mark document as ready

**Key Functions:**

#### `generateAbstract(openaiClient, chunks, documentTitle)`
- Takes first 30 chunks (or all if less than 30)
- Combines chunk content (max 20,000 characters)
- Uses GPT-4o-mini to generate exactly 100 words
- Returns abstract or null on error (non-blocking)

**Prompt:**
```
System: You are an expert at creating concise, informative abstracts from document content. 
Create a 100-word abstract that captures the key themes, purpose, and scope of the document.

User: Please create a 100-word abstract for a document titled "{title}". 
Base your abstract on the following content from the document:

{first 30 chunks combined}

Provide ONLY the abstract text, no additional commentary. 
The abstract should be exactly 100 words.
```

### 3. Database Storage

The abstract is stored in the `documents` table:

**Field:** `intro_message`

**Format (when abstract is generated):**
```html
<div class="document-abstract">
  <p><strong>Document Summary:</strong></p>
  <p>{100-word abstract}</p>
</div>
<p>Ask questions about this document below.</p>
```

**Fallback (if abstract generation fails):**
```
Ask questions about {document title}
```

**Metadata tracking:**
```json
{
  "has_ai_abstract": true,
  "user_document_id": "...",
  "user_id": "...",
  "uploaded_at": "...",
  "file_size": 123456
}
```

### 4. Processing Logs

Abstract generation is logged in `document_processing_logs`:

**Stage:** `chunk` (part of chunking stage)

**Log entries:**
- "Generating AI abstract"
- "Abstract generated successfully" (with word count and length)
- "Abstract generation skipped or failed" (if error occurs)

## Example Output

### Test Script Output
```
🚀 PDF Chunking & Abstract Generation (TEST MODE)
================================================================================

📄 Document: KPD - Protocol for Participating Donors 2019_61 012 v4.pdf
📑 Pages: 119
✂️  Chunks: 139
⏱️  Processing time: 4.9s

────────────────────────────────────────────────────────────────────────────────
📝 GENERATED ABSTRACT:
────────────────────────────────────────────────────────────────────────────────
The "Kidney Paired Donation Protocol for Participating Donors" (2019) outlines 
comprehensive guidelines for donor participation in kidney paired donation (KPD) 
programs. This third edition incorporates ethical principles, health assessments, 
and management strategies to ensure donor safety and optimize transplant outcomes. 
The protocol emphasizes rigorous medical evaluations, acceptance criteria, and 
contraindications for potential donors. It also includes a glossary of terms and 
references to existing literature, promoting best practices in kidney donation. 
By standardizing procedures, the document aims to enhance the efficacy of KPD, 
ultimately improving transplant opportunities for patients in need of kidney 
replacement therapy.
────────────────────────────────────────────────────────────────────────────────

📊 Abstract stats: 95 words
```

## Benefits

1. **User Experience**: Users immediately understand what the document is about
2. **Context**: Provides quick overview before asking questions
3. **Professional**: Automatically generated, consistent quality
4. **Non-blocking**: If abstract generation fails, document processing continues
5. **Cost-effective**: Uses GPT-4o-mini (cheaper than GPT-4)
6. **Fast**: Only uses first 30 chunks, typically completes in 2-5 seconds

## Technical Details

### Model: GPT-4o-mini
- Cost: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- Speed: Fast (2-5 seconds typical)
- Quality: Excellent for summarization tasks

### Token Usage (per abstract)
- Input: ~5,000 tokens (first 30 chunks)
- Output: ~150 tokens (100-word abstract + formatting)
- **Cost per abstract: ~$0.001** (less than 1/10th of a cent)

### Error Handling
- Abstract generation errors are caught and logged
- Processing continues even if abstract fails
- Fallback to simple intro message
- No impact on document availability

## Future Enhancements

Possible improvements:
1. Add abstract to existing documents (batch script)
2. Allow users to regenerate abstract
3. Support different abstract lengths (50/100/200 words)
4. Multi-language abstract generation
5. Include abstract in document search/filtering
6. Display abstract in document selector UI

## Testing

### Test with existing PDF:
```bash
node scripts/chunk-and-embed-with-abstract-test.js "/path/to/your/document.pdf"
```

### Test with user upload:
1. Go to Dashboard → Upload Document
2. Upload a PDF
3. Watch processing logs for "Generating AI abstract"
4. Once complete, view document in chat interface
5. Abstract should appear in intro message

## Files Modified

1. `lib/document-processor.js` - Added `generateAbstract()` function and integration
2. `scripts/chunk-and-embed-with-abstract-test.js` - New test script
3. `docs/AI-ABSTRACT-GENERATION.md` - This documentation

## Deployment Notes

- No database migrations required (uses existing `intro_message` field)
- No frontend changes required (HTML already renders in intro message)
- Requires OpenAI API key in environment
- Works immediately on next document upload
- Existing documents unaffected (can be batch-processed later if desired)

