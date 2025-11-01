# Scalable Document Registry System

## Overview

Transform the document management from hardcoded scattered configuration into a centralized database-backed registry that scales to many documents.

## Database Schema Changes

### Create `documents` Registry Table

New table to store all document metadata:

- `id` (UUID, primary key)
- `slug` (TEXT, unique) - URL-friendly identifier (e.g., 'smh', 'ckd-dm-2025')
- `title` (TEXT) - Display title
- `subtitle` (TEXT) - Additional context for UI
- `back_link` (TEXT) - URL for "Back to..." link
- `welcome_message` (TEXT) - Chatbot greeting
- `pdf_filename` (TEXT) - Filename within organized subdirectory
- `pdf_subdirectory` (TEXT) - Subdirectory: 'manuals', 'guidelines', etc.
- `embedding_type` (TEXT, CHECK IN ('openai', 'local')) - Per-document embedding strategy
- `year` (TEXT) - Version/year information
- `active` (BOOLEAN) - Enable/disable documents
- `metadata` (JSONB) - Extensible metadata storage
- `created_at`, `updated_at` (TIMESTAMPTZ)

### Update Chunk Tables

Modify both `document_chunks` and `document_chunks_local`:

- Replace `document_type TEXT CHECK(...)` with `document_slug TEXT`
- Remove restrictive CHECK constraints
- Add foreign key to `documents.slug`
- Update indexes to use `document_slug`

### Update Database Functions

Update `match_document_chunks()` and `match_document_chunks_local()`:

- Change `doc_type TEXT` parameter to `doc_slug TEXT`
- Update WHERE clause to use `document_slug`

### Migration SQL File

Create comprehensive migration: `scripts/migrate-to-document-registry.sql`

## File Organization

### Reorganize PDFs

Create subdirectory structure:

```
/PDFs/
  ├── manuals/
  │   ├── smh-manual-2023.pdf
  │   └── uhn-manual-2025.pdf
  └── guidelines/
      └── PIIS1499267125000206.pdf
```

## Backend Refactoring

### Document Registry Service (`lib/document-registry.js`)

New centralized module:

- `loadDocuments()` - Fetch all active documents from database
- `getDocumentBySlug(slug)` - Retrieve single document config
- `getDocumentPath(doc)` - Build full PDF path from subdirectory + filename
- `refreshRegistry()` - Reload from database (for runtime updates)
- Cache in-memory with TTL for performance

### Update `server.js`

**Remove hardcoded logic:**

- Delete `docNames` objects (appears 4+ times)
- Remove conditional `if/else` chains in `loadPDF()`
- Remove hardcoded validation arrays

**Implement dynamic system:**

- Load document registry on startup
- Use registry for all document lookups
- Dynamic prompt generation from registry data
- Validation against active documents from database
- Update health check endpoint to use registry

### Update Embedding Scripts

Modify `chunk-and-embed.js` and `chunk-and-embed-local.js`:

- Remove hardcoded `DOCUMENTS` array
- Fetch documents from database registry
- Support CLI arguments: `--doc=slug` or `--all`
- Use `pdf_subdirectory` + `pdf_filename` for paths
- Store using `slug` instead of legacy `type`

## Frontend Updates

### Update `config.js`

**Replace static `docConfig` object:**

- Fetch from new endpoint: `GET /api/documents`
- Cache in browser localStorage with TTL
- Fallback to defaults if fetch fails

### Update `main.js`

- Validate document slug against fetched registry
- Handle slug resolution (legacy aliases supported)
- Update error handling for invalid documents

### New API Endpoint

`GET /api/documents` - Returns active documents:

```json
{
  "documents": [
    {
      "slug": "smh",
      "title": "Nephrology Manual",
      "subtitle": "St. Michael's Hospital...",
      "backLink": "https://...",
      "welcomeMessage": "SMH Housestaff Manual",
      "embeddingType": "openai",
      "active": true
    }
  ]
}
```

## URL Parameter System

### Maintain Backwards Compatibility

Support both:

- New: `?doc=smh` (slug-based, same as before)
- Future: Allow database to define custom URL mappings

### URL Override Feature

Allow URL parameter to override database config:

- `?doc=smh&embedding=local` - Force local embeddings for testing
- Server validates override permissions

## Seed Data

### Initial Document Registry

Populate database with existing 3 documents:

1. **smh** - SMH Housestaff Manual 2023 (manuals/, openai)
2. **uhn** - UHN Nephrology Manual 2025 (manuals/, openai)
3. **CKD-dc-2025** - CKD in Diabetes Guidelines (guidelines/, local)

## Database RLS Updates

### New Policies for `documents` Table

- `anon` users: SELECT only where `active = true`
- `authenticated`: INSERT, UPDATE
- `service_role`: Full access

**Important RLS Check:**

- Verify chunks access still works with updated foreign keys
- Test that existing conversations aren't affected
- Confirm rating updates continue working

## Testing & Validation

### Test Cases

1. Existing URLs continue working (`?doc=smh`)
2. New documents can be added via database insert
3. Embedding scripts work with new registry
4. Health check reflects active documents
5. Frontend properly caches and displays document list
6. URL overrides work as expected

### Migration Safety

- Backup existing chunks before schema changes
- Test migration on development database first
- Verify data integrity after foreign key additions

## Implementation Order

1. Database schema & migration SQL
2. Document registry service module
3. Backend refactoring (server.js)
4. Reorganize PDF files
5. Update embedding scripts
6. Frontend API integration
7. Testing & validation
8. Documentation updates

## Implementation Todos

- [ ] Create documents registry table and migration SQL with proper indexes, constraints, and RLS policies
- [ ] Modify document_chunks and document_chunks_local tables to use document_slug with foreign keys
- [ ] Update match_document_chunks and match_document_chunks_local functions to use slug parameter
- [ ] Execute migration SQL and seed initial 3 documents into registry
- [ ] Create subdirectories (manuals/, guidelines/) and move PDF files accordingly
- [ ] Create lib/document-registry.js with caching, database queries, and path resolution
- [ ] Remove hardcoded document logic from server.js and integrate document registry service
- [ ] Add GET /api/documents endpoint to expose active documents to frontend
- [ ] Refactor chunk-and-embed scripts to use database registry instead of hardcoded arrays
- [ ] Modify config.js to fetch documents from API with localStorage caching
- [ ] Update main.js to validate against dynamic document registry
- [ ] Test all existing URLs, RAG retrieval, and document loading with new system
- [ ] Update URL-PARAMETERS.md and other documentation to reflect new scalable system

