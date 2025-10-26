# URL Parameter Configuration Guide

The chatbot supports URL parameters for controlling document selection and retrieval method. Documents are now managed through a **database-backed registry system** that scales to many documents.

## Document Registry System

**Important:** Document availability is now determined by the database registry, not hardcoded configuration. New documents can be added by inserting records into the `documents` table without code changes.

## Available Parameters

### 1. `doc` - Document Selection
Selects which document to use for queries using the document's **slug** identifier.

**How it works:**
- Documents are loaded dynamically from the `/api/documents` endpoint
- Frontend validates slugs against the active documents in the registry
- Invalid slugs fall back to the default document (smh)
- Document list is cached in browser localStorage for 5 minutes

**Current Documents** (as of initial migration):
- `smh` - SMH Housestaff Manual 2023 (default)
- `uhn` - UHN Nephrology Manual 2025
- `ckd-dc-2025` - CKD in Diabetes Guidelines 2025

**Examples:**
```
http://localhost:3456?doc=smh
http://localhost:3456?doc=uhn
http://localhost:3456?doc=ckd-dc-2025
```

**Adding New Documents:**
To add a new document, insert a record into the `documents` table:
```sql
INSERT INTO documents (slug, title, subtitle, back_link, welcome_message, 
                      pdf_filename, pdf_subdirectory, embedding_type, year, active)
VALUES ('new-doc', 'New Document Title', 'Subtitle text', 
        'https://example.com/link', 'Welcome message',
        'document.pdf', 'manuals', 'openai', '2025', true);
```

### 2. `method` - Retrieval Method
Controls whether to use Full Document or RAG retrieval.

**Options:**
- (no parameter) - Full Document mode (default)
- `rag` - RAG (Retrieval Augmented Generation) mode

**Examples:**
```
http://localhost:3456?method=rag
http://localhost:3456
```

### 3. `back-button` - Back Button Configuration
Controls whether to show a back button in the mobile view and where it should link to.

**Behavior:**
- If the parameter is present, the back button will be shown in mobile view with the specified URL
- If the parameter is absent, no back button will be displayed
- This replaces the old hardcoded "Back to Manual" button

**Examples:**
```
# Show back button linking to a specific page
http://localhost:3456?doc=smh&back-button=https://brightbean.io/manuals

# Show back button linking to homepage
http://localhost:3456?doc=uhn&back-button=https://brightbean.io

# No back button (parameter omitted)
http://localhost:3456?doc=smh
```

**Use Cases:**
- Embed the chatbot in different contexts with appropriate back navigation
- Create custom navigation flows for different document types
- Remove back button entirely for standalone deployments

## Combined Parameters

You can combine parameters using `&`:

```
http://localhost:3456?doc=uhn&method=rag
http://localhost:3456?doc=smh&method=rag&back-button=https://brightbean.io
http://localhost:3456?doc=ckd-dc-2025&method=rag&back-button=https://example.com/guidelines
```

## Production vs Local Behavior

### Local Environment (localhost)
- **Toggle buttons visible** - Users can manually switch between modes
- URL parameters set the initial state
- Buttons override URL parameters when clicked

### Production Environment
- **Toggle buttons hidden** - Only URL parameters control the mode
- Cleaner UI for end users
- Full control through URL configuration

## Use Cases

### 1. Embed with Specific Configuration
Create iframes with pre-configured settings:

```html
<!-- SMH Manual with RAG mode -->
<iframe src="https://your-domain.com/chat?doc=smh&method=rag"></iframe>

<!-- UHN Manual with Full Doc mode -->
<iframe src="https://your-domain.com/chat?doc=uhn"></iframe>
```

### 2. Direct Links
Share links with specific configurations:

```
https://brightbean.io/chat?doc=uhn&method=rag
https://brightbean.io/chat?doc=smh
```

### 3. Testing Locally
Test both modes easily during development:

```
http://localhost:3456?doc=smh
http://localhost:3456?doc=smh&method=rag
http://localhost:3456?doc=uhn
http://localhost:3456?doc=uhn&method=rag
```

## Performance Metadata

Both modes now display performance information at the bottom of each response:

**Full Doc Mode:**
```
📄 Full Doc Mode: Entire 193 pages context (response time: 4250ms)
```

**RAG Mode:**
```
🔍 RAG Mode: Used 3 relevant chunks (retrieval: 1170ms, total: 3420ms)
```

## Default Behavior

If no parameters are provided:
- **Document:** SMH Manual (default)
- **Method:** Full Document mode (default)

```
http://localhost:3456
```
Equivalent to:
```
http://localhost:3456?doc=smh
```

## URL Parameter Priority

1. URL parameters set initial state on page load
2. In local environment, toggle buttons can override URL settings
3. In production, only URL parameters control behavior (no buttons visible)

## Browser Console Logging

Check the browser console to see which mode is active:

**Local Environment:**
```
🏠 Local environment detected - retrieval controls visible
```

**Production Environment:**
```
🌐 Production environment - retrieval controls hidden
```

**RAG Mode Activated:**
```
🔍 RAG mode enabled via URL parameter
```

## Implementation Notes

### Frontend
- URL parameters are read on page load via `URLSearchParams`
- Document registry loaded from `/api/documents` endpoint
- Frontend validates document slugs asynchronously
- Document cache stored in localStorage with 5-minute TTL
- Fallback to hardcoded config if API fails
- Localhost detection: `hostname === 'localhost' || '127.0.0.1'`
- CSS class `local-env` added to `<body>` for local environment
- Toggle buttons have `display: none` in production via CSS

### Backend
- Documents loaded from `documents` table in Supabase
- Document registry cached in-memory with 5-minute TTL
- PDF paths resolved via `lib/document-registry.js`
- Dynamic validation against active documents
- Health check reflects loaded documents from registry

### Database
- `documents` table stores all document metadata
- `document_chunks` and `document_chunks_local` use `document_slug` (not `document_type`)
- Foreign key constraints ensure data integrity
- RLS policies control access (anon can read active documents only)

## Scalability Features

1. **No Code Changes Needed** - Add documents via database INSERT
2. **Dynamic Loading** - Server loads all active documents on startup
3. **Organized Storage** - PDFs organized in subdirectories (`manuals/`, `guidelines/`)
4. **Per-Document Embedding Strategy** - Each document can use openai or local embeddings
5. **Caching** - Both frontend and backend cache document registry for performance
6. **Validation** - Automatic slug validation against active documents

## Migration & Maintenance

### Running the Migration

**IMPORTANT:** You must run the migration SQL before the new system will work:

```bash
# The migration SQL is in:
scripts/migrate-to-document-registry.sql
```

Use Supabase MCP or SQL Editor to execute the migration. This will:
- Create the `documents` table
- Migrate existing chunks to use `document_slug`
- Seed the 3 initial documents
- Update database functions

### Embedding New Documents

After adding a document to the registry:

```bash
# For OpenAI embeddings (1536D):
node scripts/chunk-and-embed.js --doc=new-slug

# For local embeddings (384D):
node scripts/chunk-and-embed-local.js --doc=new-slug

# Process all documents:
node scripts/chunk-and-embed.js --all
node scripts/chunk-and-embed-local.js --all
```

### Clearing Caches

**Frontend:**
```javascript
// In browser console:
localStorage.removeItem('ukidney-documents-cache');
// Or use the helper:
import { clearDocumentCache } from './js/config.js';
clearDocumentCache();
```

**Backend:**
```javascript
// Restart the server or use:
const documentRegistry = require('./lib/document-registry');
documentRegistry.clearCache();
```

## Testing Checklist

### Basic Functionality
- [ ] Local: `http://localhost:3456` - Shows toggle buttons
- [ ] Local: `http://localhost:3456?method=rag` - RAG mode active, buttons visible
- [ ] Local: `http://localhost:3456?doc=uhn` - UHN manual loaded, buttons visible
- [ ] Production: Toggle buttons should be hidden
- [ ] Production: `?method=rag` should activate RAG mode
- [ ] Production: `?doc=uhn&method=rag` should use UHN + RAG

### Registry System
- [ ] `/api/documents` endpoint returns document list
- [ ] Invalid document slug falls back to default
- [ ] Server loads all active documents on startup
- [ ] Health check shows document registry info
- [ ] Frontend caches documents in localStorage
- [ ] Backend caches registry in memory

### Database
- [ ] Migration completed successfully
- [ ] 3 documents seeded in `documents` table
- [ ] `document_chunks` uses `document_slug` column
- [ ] `document_chunks_local` uses `document_slug` column
- [ ] Foreign key constraints enforced
- [ ] RLS policies work correctly

## Related Files

### Core System
- `lib/document-registry.js` - Document registry service (NEW)
- `scripts/migrate-to-document-registry.sql` - Database migration (NEW)
- `plans/document-registry-refactor.md` - Implementation plan (NEW)

### Backend
- `server.js` - Backend with dynamic document loading
- `/api/documents` - New API endpoint for document list
- `/api/health` - Health check with registry info

### Frontend
- `public/js/config.js` - Dynamic document loading with caching
- `public/js/main.js` - Async document validation
- `public/js/ui.js` - Async UI updates
- `public/index.html` - Frontend implementation

### Embedding Scripts
- `scripts/chunk-and-embed.js` - OpenAI embeddings (now uses registry)
- `scripts/chunk-and-embed-local.js` - Local embeddings (now uses registry)

### Documentation
- `URL-PARAMETERS.md` - This file
- `RAG-SETUP.md` - RAG system documentation
- `README.md` - Project overview

