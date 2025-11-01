# UI Module Quick Reference

**Last Updated:** October 22, 2025

Quick reference guide for working with the refactored UI modules.

---

## Import Guide

### Standard Import (Recommended)
```javascript
// Import from barrel export - maintains backward compatibility
import { updateDocumentUI, addMessage, addLoading } from './ui.js?v=20251022-01';
```

### Direct Module Import (Advanced)
```javascript
// Import directly from specific modules for better tree-shaking
import { updateDocumentUI } from './ui-document.js';
import { addMessage } from './ui-messages.js';
import { addLoading } from './ui-loading.js';
```

---

## Module Map

### Where to Find Functions

| Function | Module | Purpose |
|----------|--------|---------|
| `updateDocumentUI()` | `ui-document.js` | Main document UI orchestration |
| `addMessage()` | `ui-messages.js` | Render chat messages |
| `addLoading()` | `ui-loading.js` | Show loading indicator |
| `removeLoading()` | `ui-loading.js` | Hide loading indicator |
| `updateModelInTooltip()` | `ui-messages.js` | Update model display |
| `buildResponseWithMetadata()` | `ui-messages.js` | Add metadata to responses |
| `styleReferences()` | `ui-content-styling.js` | Style references section |
| `wrapDrugConversionContent()` | `ui-content-styling.js` | Detect drug conversions |
| `addDownloadsToWelcome()` | `ui-downloads.js` | Add downloads section |
| `updateMetaTags()` | `ui-utils.js` | Update SEO meta tags |
| `darkenColor()` | `ui-utils.js` | Darken hex colors |
| `hexToRgba()` | `ui-utils.js` | Convert hex to RGBA |
| `equalizeContainerHeights()` | `ui-utils.js` | Equalize layout heights |

---

## Common Tasks

### Adding a New UI Feature

**1. Determine the appropriate module:**
- **Document-related?** → `ui-document.js`
- **Message rendering?** → `ui-messages.js`
- **Loading states?** → `ui-loading.js`
- **Content styling?** → `ui-content-styling.js`
- **Downloads?** → `ui-downloads.js`
- **Shared utility?** → `ui-utils.js`
- **New category?** → Create new `ui-[category].js`

**2. Add your function to the module:**
```javascript
// Example: Adding a new function to ui-utils.js
export function myNewUtility(param1, param2) {
    // Implementation
}
```

**3. Export from barrel file (ui.js):**
```javascript
// Add to ui.js
export { myNewUtility } from './ui-utils.js';
```

**4. Update version parameter:**
```javascript
// In files that import ui.js
import { myNewUtility } from './ui.js?v=20251022-02'; // Increment version
```

### Modifying Existing Functions

**1. Find the function:**
```bash
# Search for function definition
grep -r "export function functionName" public/js/ui*.js
```

**2. Edit in the appropriate module**

**3. Test thoroughly** - changes affect all callers

**4. Update version if needed** (for cache busting)

### Debugging

**Check module loading:**
```javascript
// In browser console
console.log('UI modules loaded:', {
    utils: typeof updateMetaTags !== 'undefined',
    document: typeof updateDocumentUI !== 'undefined',
    messages: typeof addMessage !== 'undefined',
    loading: typeof addLoading !== 'undefined',
    styling: typeof styleReferences !== 'undefined',
    downloads: typeof addDownloadsToWelcome !== 'undefined'
});
```

**Check import errors:**
```javascript
// Look for module resolution errors in browser console
// Common issues:
// - Missing version parameter
// - Circular dependencies
// - Typos in import paths
```

---

## Module Dependencies

### Dependency Tree
```
ui.js (barrel)
├─→ ui-utils.js (no dependencies)
├─→ ui-loading.js
│   └─→ facts.js
├─→ ui-downloads.js (no dependencies)
├─→ ui-content-styling.js (no dependencies)
├─→ ui-messages.js
│   └─→ ui-content-styling.js
└─→ ui-document.js
    ├─→ config.js
    ├─→ ui-utils.js
    └─→ ui-downloads.js
```

### Safe to Modify (Low Dependencies)
- ✅ `ui-utils.js` - No internal dependencies
- ✅ `ui-loading.js` - Only depends on facts.js
- ✅ `ui-downloads.js` - No internal dependencies
- ✅ `ui-content-styling.js` - No internal dependencies

### Modify with Care (Has Dependents)
- ⚠️ `ui-messages.js` - Used by chat.js
- ⚠️ `ui-document.js` - Used by main.js
- ⚠️ `ui-content-styling.js` - Used by ui-messages.js
- ⚠️ `ui-utils.js` - Used by ui-document.js

---

## Function Signatures

### Document Management
```javascript
// Update entire document UI
updateDocumentUI(selectedDocument: string, forceRefresh: boolean = false): Promise<void>
```

### Message Rendering
```javascript
// Add a message to chat
addMessage(
    content: string,
    role: 'user' | 'assistant',
    model?: string,
    conversationId?: string,
    chatContainer: HTMLElement,
    userMessage?: string,
    state?: object,
    sendMessageCallback?: function
): void

// Update model tooltip
updateModelInTooltip(selectedModel: 'gemini' | 'grok' | 'grok-reasoning'): void

// Build response with metadata
buildResponseWithMetadata(data: object, isLocalEnv: boolean): string
```

### Loading States
```javascript
// Show loading indicator
addLoading(chatContainer: HTMLElement): void

// Hide loading indicator
removeLoading(): void
```

### Content Styling
```javascript
// Style references section
styleReferences(contentDiv: HTMLElement): void

// Wrap drug conversion content
wrapDrugConversionContent(contentDiv: HTMLElement): boolean
```

### Downloads
```javascript
// Add downloads to welcome message
addDownloadsToWelcome(container: HTMLElement, validConfigs: Array<object>): void
```

### Utilities
```javascript
// Update meta tags
updateMetaTags(title: string, description: string): void

// Darken color
darkenColor(hex: string, percent: number): string

// Convert hex to RGBA
hexToRgba(hex: string, alpha: number): string

// Equalize container heights
equalizeContainerHeights(): void
```

---

## Best Practices

### 1. **Always Use Version Parameters**
```javascript
// ✅ Good
import { addMessage } from './ui.js?v=20251022-01';

// ❌ Bad (no cache busting)
import { addMessage } from './ui.js';
```

### 2. **Import from Barrel for Backward Compatibility**
```javascript
// ✅ Good (backward compatible)
import { updateDocumentUI } from './ui.js?v=20251022-01';

// ⚠️ Advanced (direct import, better tree-shaking)
import { updateDocumentUI } from './ui-document.js';
```

### 3. **Keep Modules Focused**
- Each module should have a single, clear responsibility
- If a module grows > 500 lines, consider splitting
- Avoid circular dependencies

### 4. **Document Public APIs**
- Add JSDoc comments to all exported functions
- Include parameter types and return types
- Provide usage examples

### 5. **Test Cross-Module Changes**
- Changes to shared utilities affect multiple modules
- Test all dependent functionality
- Check browser console for errors

---

## Troubleshooting

### Module Not Found
```
Error: Failed to resolve module specifier './ui-utils.js'
```
**Solution:** Check import path and ensure file exists

### Circular Dependency
```
Warning: Circular dependency detected
```
**Solution:** Refactor to remove circular imports, use dependency injection

### Function Not Defined
```
TypeError: functionName is not a function
```
**Solution:** 
1. Check export in source module
2. Check import in barrel file (ui.js)
3. Verify version parameter for cache busting

### Stale Cache
```
Old version of module still loading
```
**Solution:** 
1. Increment version parameter
2. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+F5)
3. Clear browser cache

---

## Performance Tips

### 1. **Lazy Loading**
```javascript
// Load modules only when needed
const loadDocumentUI = async () => {
    const { updateDocumentUI } = await import('./ui-document.js');
    return updateDocumentUI;
};
```

### 2. **Tree Shaking**
- Import only what you need
- Use named imports, not default exports
- Let bundlers remove unused code

### 3. **Code Splitting**
- Keep modules small and focused
- Split large features into sub-modules
- Use dynamic imports for rarely-used features

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v20251022-01 | Oct 22, 2025 | Initial modular refactor |
| v20251019-02 | Oct 19, 2025 | Last monolithic version (backup) |

---

## Resources

- **Full Documentation:** `/docs/UI-REFACTOR-SUMMARY.md`
- **Original Backup:** `/public/js/ui.js.backup`
- **Plan Document:** `/refactor-ui.plan.md`

---

**Need Help?** Check the full refactor summary or examine the backup file to understand the original structure.

