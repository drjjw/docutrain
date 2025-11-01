# Server Module Guide

Quick reference for the refactored server architecture.

## Module Overview

```
server.js (230 lines)
├── lib/
│   ├── utils.js (90 lines)
│   ├── middleware.js (30 lines)
│   ├── rag.js (330 lines)
│   └── routes/
│       ├── chat.js (450 lines)
│       ├── documents.js (200 lines)
│       ├── health.js (180 lines)
│       ├── rating.js (60 lines)
│       └── cache.js (50 lines)
```

## When to Edit Which File

### Adding a New Endpoint

**For chat-related endpoints:**
- Edit: `lib/routes/chat.js`
- Add new route to the router

**For document-related endpoints:**
- Edit: `lib/routes/documents.js`
- Add new route to the router

**For monitoring endpoints:**
- Edit: `lib/routes/health.js`
- Add new route to the router

**For new feature category:**
- Create: `lib/routes/your-feature.js`
- Import and mount in `server.js`

### Modifying RAG Logic

**For embedding generation:**
- Edit: `lib/rag.js` → `embedQuery()`

**For chunk retrieval:**
- Edit: `lib/rag.js` → `findRelevantChunks()` or `findRelevantChunksLocal()`

**For prompt generation:**
- Edit: `lib/rag.js` → `getRAGSystemPrompt()`, `getRAGGeminiPrompt()`, or `getRAGGrokPrompt()`

**For AI chat logic:**
- Edit: `lib/rag.js` → `chatWithRAGGemini()` or `chatWithRAGGrok()`

### Adding Utility Functions

**For HTML/XSS utilities:**
- Edit: `lib/utils.js`

**For database logging:**
- Edit: `lib/utils.js`

**For middleware:**
- Edit: `lib/middleware.js`

### Modifying Server Initialization

**For client initialization:**
- Edit: `server.js` → Initialization section

**For route registration:**
- Edit: `server.js` → Route registration section

**For startup logic:**
- Edit: `server.js` → `start()` function

## Module Dependencies

### lib/utils.js
**Exports:**
- `sanitizeIntroHTML(html)`
- `escapeHtml(text)`
- `logConversation(supabase, data)`

**Dependencies:** None

### lib/middleware.js
**Exports:**
- `setupMiddleware()`

**Dependencies:**
- `cors`
- `express`

### lib/rag.js
**Exports:**
- `embedQuery(openaiClient, text)`
- `findRelevantChunks(supabase, embedding, documentTypes, limit, threshold)`
- `findRelevantChunksLocal(supabase, embedding, documentTypes, limit, threshold)`
- `getRAGSystemPrompt(documentRegistry, documentTypes, chunks)`
- `getRAGGeminiPrompt(documentRegistry, documentType, chunks)`
- `getRAGGrokPrompt(documentRegistry, documentType, chunks)`
- `chatWithRAGGemini(genAI, documentRegistry, message, history, documentType, chunks)`
- `chatWithRAGGrok(xai, documentRegistry, message, history, documentType, chunks, modelName)`

**Dependencies:**
- Supabase client (passed)
- OpenAI client (passed)
- Document registry (passed)
- AI clients (passed)

### lib/routes/chat.js
**Exports:**
- `createChatRouter(dependencies)`

**Dependencies:**
- `express`
- `uuid`
- All RAG functions
- Supabase client
- Document registry
- Embedding cache
- Local embeddings
- AI clients

### lib/routes/documents.js
**Exports:**
- `createDocumentsRouter(supabase, documentRegistry, registryState, escapeHtml)`

**Dependencies:**
- `express`
- `fs`
- `path`
- Supabase client
- Document registry
- Registry state
- `escapeHtml` utility

### lib/routes/health.js
**Exports:**
- `createHealthRouter(supabase, documentRegistry, registryState)`

**Dependencies:**
- `express`
- Supabase client
- Document registry
- Registry state

### lib/routes/rating.js
**Exports:**
- `createRatingRouter(supabase)`

**Dependencies:**
- `express`
- Supabase client

### lib/routes/cache.js
**Exports:**
- `createCacheRouter(embeddingCache)`

**Dependencies:**
- `express`
- Embedding cache module

## Common Tasks

### Adding a New Route

1. Choose the appropriate route file (or create new one)
2. Add route handler to the router
3. If new file, import and mount in `server.js`

Example:
```javascript
// In lib/routes/your-feature.js
const express = require('express');
const router = express.Router();

function createYourFeatureRouter(dependencies) {
  router.get('/your-endpoint', async (req, res) => {
    // Your logic here
  });
  
  return router;
}

module.exports = { createYourFeatureRouter };
```

```javascript
// In server.js
const { createYourFeatureRouter } = require('./lib/routes/your-feature');
app.use('/api', createYourFeatureRouter(routeDependencies));
```

### Modifying RAG Behavior

1. Locate the relevant function in `lib/rag.js`
2. Make your changes
3. Test with both single and multi-document queries

### Adding a New AI Model

1. Initialize client in `server.js`
2. Add to `routeDependencies.clients`
3. Add chat function in `lib/rag.js`
4. Add model handling in `lib/routes/chat.js`

### Debugging Request Flow

1. **Entry Point**: `lib/routes/chat.js` → POST `/api/chat`
2. **Validation**: Document slug validation
3. **Embedding**: `lib/rag.js` → `embedQuery()` or local
4. **Retrieval**: `lib/rag.js` → `findRelevantChunks()`
5. **Generation**: `lib/rag.js` → `chatWithRAGGemini()` or `chatWithRAGGrok()`
6. **Logging**: Supabase insert
7. **Response**: JSON with metadata

## Testing Individual Modules

### Test RAG Functions
```javascript
const rag = require('./lib/rag');
// Test embedQuery, findRelevantChunks, etc.
```

### Test Route Handlers
```javascript
const { createChatRouter } = require('./lib/routes/chat');
// Create mock dependencies and test
```

### Test Utilities
```javascript
const { sanitizeIntroHTML, escapeHtml } = require('./lib/utils');
// Test with various inputs
```

## Performance Considerations

### RAG Functions (lib/rag.js)
- `embedQuery()`: ~200-500ms (OpenAI API call)
- `findRelevantChunks()`: ~50-200ms (Supabase RPC)
- `chatWithRAGGemini()`: ~1-3s (Gemini API call)
- `chatWithRAGGrok()`: ~1-3s (Grok API call)

### Route Handlers
- `/api/chat`: ~2-4s total (embedding + retrieval + generation)
- `/api/health`: ~10-50ms
- `/api/documents`: ~10-50ms
- `/api/analytics`: ~100-500ms (database query)

## Error Handling

All route handlers include try-catch blocks with:
- Detailed error logging
- User-friendly error messages
- Appropriate HTTP status codes

Example:
```javascript
try {
  // Route logic
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({ 
    error: 'User-friendly message',
    details: error.message 
  });
}
```

## Logging Conventions

- `console.log()` for info and success
- `console.warn()` for warnings
- `console.error()` for errors
- Use emojis for visual scanning: ✓ ⚠️ ❌ 🔍 🤖 📊

## Security Considerations

### Input Validation
- All user inputs validated in route handlers
- Document slugs validated against registry
- Session IDs validated as UUIDs

### XSS Prevention
- `escapeHtml()` for all user-generated content
- `sanitizeIntroHTML()` for HTML intro messages
- Meta tag content always escaped

### SQL Injection Prevention
- All database queries use parameterized queries
- Supabase client handles escaping

## Deployment Notes

### Files to Deploy
- `server.js`
- `lib/utils.js`
- `lib/middleware.js`
- `lib/rag.js`
- `lib/routes/*.js`
- All existing files (`lib/document-registry.js`, `lib/embedding-cache.js`, etc.)

### Environment Variables
No changes to environment variables needed.

### Database
No schema changes needed.

### Restart Required
Yes, server must be restarted after deploying new code.

## Troubleshooting

### Server Won't Start
1. Check syntax: `node --check server.js`
2. Check all modules: `node --check lib/**/*.js`
3. Check environment variables
4. Check database connection

### Route Not Found
1. Verify route is registered in `server.js`
2. Check route path matches request
3. Verify router is exported correctly

### RAG Not Working
1. Check OpenAI API key
2. Check Supabase connection
3. Check document registry loaded
4. Check embedding cache

### Performance Issues
1. Check database query performance
2. Check API response times
3. Check chunk limit configuration
4. Check embedding cache hit rate

