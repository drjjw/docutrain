# Document Processing System

This directory contains comprehensive documentation for the RAG document processing pipeline, including PDF ingestion, chunking, embedding generation, and page number detection.

## 📚 Documentation Index

1. **[Adding New Documents](./ADDING-NEW-DOCUMENTS.md)** - Step-by-step guide for adding new PDFs to the system
2. **[Page Number System](./PAGE-NUMBER-SYSTEM.md)** - How page detection works and troubleshooting
3. **[Batch Processing](./BATCH-PROCESSING.md)** - Processing multiple documents efficiently
4. **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions
5. **[Technical Architecture](./TECHNICAL-ARCHITECTURE.md)** - How the system works under the hood

## 🎯 Quick Start

### Adding a Single Document

```bash
# 1. Place PDF in appropriate directory (e.g., PDFs/manuals/)
# 2. Process with OpenAI embeddings
node scripts/chunk-and-embed.js --doc=your-document-slug

# 3. Process with local embeddings
node scripts/chunk-and-embed-local.js --doc=your-document-slug
```

### Batch Processing

```bash
# Process multiple documents at once
./scripts/batch-train.sh openai doc1 doc2 doc3
./scripts/batch-train.sh local doc1 doc2 doc3
```

## 🔍 Key Features

- **Automatic Page Number Detection**: System automatically inserts page markers for accurate citations
- **Dual Embedding Support**: Both OpenAI (text-embedding-3-small) and local (all-MiniLM-L6-v2) embeddings
- **Validation**: Built-in page number validation after processing
- **Flexible Chunking**: Configurable chunk size (~500 tokens) with overlap (~100 tokens)

## ⚠️ Critical Information

### Page Number System (October 2024 Fix)

**Problem**: 95% of documents had broken page numbering (all chunks showing "Page 1" or no page numbers).

**Solution**: Implemented automatic page marker insertion in `extractPDFTextWithPageMarkers()` function. This is now **permanent and automatic** for all documents.

**Details**: See [PAGE-NUMBER-SYSTEM.md](./PAGE-NUMBER-SYSTEM.md)

## 📊 System Status

- **Total Documents**: 123 active documents
- **Embedding Types**: OpenAI (1536 dimensions), Local (384 dimensions)
- **Database Tables**: `document_chunks` (OpenAI), `document_chunks_local` (local)
- **Page Number Detection**: ✅ Automatic and validated

## 🛠️ Key Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `chunk-and-embed.js` | Process with OpenAI embeddings | `node scripts/chunk-and-embed.js --doc=slug` |
| `chunk-and-embed-local.js` | Process with local embeddings | `node scripts/chunk-and-embed-local.js --doc=slug` |
| `batch-train.sh` | Batch process multiple docs | `./scripts/batch-train.sh openai doc1 doc2` |
| `batch-train-documents.js` | Full pipeline (registry + training) | `node scripts/batch-train-documents.js` |

## 📝 Document Registry

All documents are registered in the `document_registry` table in Supabase with:
- Slug (unique identifier)
- Display name
- Owner
- Embedding type (openai/local)
- File path
- Chunk limit override (optional)

## 🔗 Related Documentation

- [DOWNLOADS-FEATURE.md](../DOWNLOADS-FEATURE.md) - Document download functionality
- [MULTI-DOCUMENT-RAG-COMPLETE.md](../MULTI-DOCUMENT-RAG-COMPLETE.md) - Multi-document querying
- [SERVER-REFACTORING-SUMMARY.md](../SERVER-REFACTORING-SUMMARY.md) - Server architecture

## 💡 Best Practices

1. **Always process both embedding types** for each document
2. **Check validation output** after processing to confirm page numbers
3. **Use batch processing** for multiple documents (more efficient)
4. **Test search functionality** after adding new documents
5. **Monitor database size** - large documents create many chunks

## 🆘 Need Help?

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

