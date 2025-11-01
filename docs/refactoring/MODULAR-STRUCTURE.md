# Modular Structure Documentation

## Overview

The application has been refactored from a single 1,114-line `index.html` file into a modular structure with automatic cache busting for production deployments.

## File Structure

### Development Files (`public/`)

```
public/
├── index.html (77 lines) - Main HTML structure
├── css/
│   └── styles.css (628 lines) - All application styles
└── js/
    ├── config.js (36 lines) - Configuration and constants
    ├── api.js (42 lines) - API communication
    ├── ui.js (165 lines) - UI updates and message rendering
    ├── chat.js (54 lines) - Chat logic and conversation management
    ├── rating.js (43 lines) - Rating submission
    └── main.js (129 lines) - Initialization and event wiring
```

### Production Build (`dist/`)

After running `node build.js`, files are copied to `dist/` with content-based hashes:

```
dist/public/
├── index.html - HTML with hashed references
├── css/
│   └── styles.{hash}.css - Hashed CSS file
└── js/
    ├── config.{hash}.js
    ├── api.{hash}.js
    ├── ui.{hash}.js
    ├── chat.{hash}.js
    ├── rating.{hash}.js
    └── main.{hash}.js
```

## JavaScript Module Structure

### config.js
- `getAPIBaseURL()` - Auto-detect API base URL
- `API_URL` - Configured API endpoint
- `docConfig` - Document configuration (SMH/UHN)
- `generateSessionId()` - Generate unique session IDs

### api.js
- `checkHealth()` - Check server health and loaded documents
- `sendMessageToAPI()` - Send chat messages to backend

### ui.js
- `updateDocumentUI()` - Update header and welcome message
- `addMessage()` - Add messages to chat with markdown rendering
- `addLoading()` / `removeLoading()` - Loading indicators
- `buildResponseWithMetadata()` - Build responses with performance metadata

### chat.js
- `sendMessage()` - Main chat logic orchestration

### rating.js
- `submitRating()` - Submit thumbs up/down ratings

### main.js
- Entry point and initialization
- Event listener setup
- Model and retrieval mode selectors
- Application state management

## Development Workflow

### Local Development
```bash
# Work directly with source files
# No build step needed
# Files load from public/ directory
```

### Production Build
```bash
# Build with cache busting
node build.js

# Deploy dist/ directory to server
# Files will have content-based hashes
# Automatic cache invalidation
```

## Cache Busting

The build system automatically:
1. Generates MD5 hashes (8 chars) from file content
2. Creates files like `styles.6836d329.css`
3. Updates HTML references to hashed filenames
4. Hash changes automatically when content changes

### Example
- Development: `<link rel="stylesheet" href="css/styles.css">`
- Production: `<link rel="stylesheet" href="css/styles.6836d329.css">`

## Benefits

✅ **Maintainability**: Easy to find and edit specific functionality
✅ **Modularity**: Clear separation of concerns
✅ **Cache Busting**: Automatic cache invalidation in production
✅ **No Manual Versioning**: Content changes = new hash
✅ **Clean Code**: 77-line HTML vs. 1,114-line monolith
✅ **ES6 Modules**: Modern JavaScript with imports/exports

## Migration Notes

- Original `index.html` reduced from 1,114 → 77 lines (93% reduction)
- All CSS extracted to `styles.css` (628 lines)
- JavaScript split into 6 focused modules (469 lines total)
- Build process enhanced with MD5 hashing
- No external dependencies added (uses Node.js built-in `crypto`)

## Testing

### Verify Module Syntax
```bash
node -c public/js/*.js
```

### Test Build Process
```bash
node build.js
# Check dist/public/ for hashed files
```

### Verify Hashed References
```bash
cat dist/public/index.html | grep -E "(styles\.|main\.)"
# Should show hashed filenames
```







