# Inline Editor Cache Fix

**Date**: November 2, 2025  
**Component**: `InlineWysiwygEditor.tsx`  
**Issue**: Stale cached data persisting after saving intro messages, requiring manual localStorage deletion

## Problem Description

When users saved changes via the inline WYSIWYG editor (intro messages), the changes would not immediately reflect in the UI. Users had to manually delete localStorage entries to see their updates. The specific localStorage key causing issues was related to the document cache.

### Root Cause

The `InlineWysiwygEditor` component had overly complex "optimistic update" logic that was interfering with the normal cache invalidation flow:

1. **Optimistic Update Logic**: The component maintained separate `displayValue` and `savedValue` state variables to show changes immediately before the backend confirmed them.

2. **Stale Data Protection**: It had logic to prevent "stale cached data" from overwriting the optimistic update by comparing the incoming `value` prop with `savedValue`.

3. **Timing Issues**: The comparison was strict (`value === savedValue`), but the HTML could differ slightly due to:
   - Different whitespace/formatting
   - Double sanitization (once on save, once on load)
   - Browser-specific HTML serialization differences

4. **Cache Blocking**: If the refetch happened within 2 seconds and the HTML didn't match exactly, the component would ignore the fresh data and keep showing the old optimistic value.

### The Caching Flow

The app has a proper cache invalidation system:

```typescript
// WelcomeMessage.tsx
const handleSave = async (field: string, value: string) => {
  const success = await saveDocumentField(documentSlug, field, value);
  if (success) {
    // 1. Clear localStorage caches
    clearAllDocumentCaches();
    
    // 2. Dispatch event to trigger refetch
    window.dispatchEvent(new Event('document-updated'));
  }
};

// useDocumentConfig.ts
window.addEventListener('document-updated', handleDocumentUpdate);

const handleDocumentUpdate = () => {
  // 3. Clear in-memory caches
  errorCache.delete(documentSlug);
  configCache.delete(cacheKey);
  
  // 4. Force refetch from API
  loadConfig(true);
};
```

This flow was working correctly, but the `InlineWysiwygEditor` was blocking the fresh data from displaying.

## Solution Implemented

### Removed Optimistic Update Logic

Simplified the component by removing the problematic optimistic update state:

**Before**:
```typescript
const [displayValue, setDisplayValue] = useState(value);
const [justSaved, setJustSaved] = useState(false);
const [savedValue, setSavedValue] = useState<string | null>(null);

useEffect(() => {
  if (!isEditing) {
    setEditValue(value);
    if (!justSaved) {
      setDisplayValue(value);
    } else if (savedValue !== null && value === savedValue) {
      setDisplayValue(value);
      setJustSaved(false);
      setSavedValue(null);
    }
    // If justSaved is true and value doesn't match savedValue, 
    // ignore the prop update (PROBLEM!)
  }
}, [value, isEditing, justSaved, savedValue]);
```

**After**:
```typescript
// No displayValue, justSaved, or savedValue state

useEffect(() => {
  if (!isEditing) {
    setEditValue(value);
    isInitializedRef.current = false;
  }
}, [value, isEditing]);
```

### Simplified Save Handler

**Before**:
```typescript
const handleSave = async () => {
  const success = await onSave(newValue);
  if (success) {
    setDisplayValue(newValue);  // Optimistic update
    setEditValue(newValue);
    setJustSaved(true);
    setSavedValue(newValue);
    setIsEditing(false);
    
    setTimeout(() => {
      if (justSaved) {
        setJustSaved(false);
        setSavedValue(null);
      }
    }, 2000); // 2 second timeout
  }
};
```

**After**:
```typescript
const handleSave = async () => {
  const success = await onSave(newValue);
  if (success) {
    setEditValue(newValue);
    setIsEditing(false);
    // Parent component dispatches 'document-updated' event
    // which triggers refetch, and new value prop updates this component
  }
};
```

### Direct Value Prop Usage

The component now directly uses the `value` prop for display instead of maintaining a separate `displayValue`:

```typescript
// Display (non-editing mode)
<div dangerouslySetInnerHTML={{ __html: value }} />

// Editor initialization
editorRef.current.innerHTML = value;
```

## Benefits

### 1. **Immediate Updates**
- Changes now reflect immediately after save without manual cache clearing
- No more localStorage deletion required

### 2. **Simpler Code**
- Removed ~50 lines of complex state management
- Easier to understand and maintain
- Fewer edge cases to handle

### 3. **Reliable Cache Invalidation**
- Trusts the existing cache invalidation system
- No interference with the refetch flow
- Fresh data always displays

### 4. **Better UX**
- Consistent behavior across all inline editors
- No confusing delays or stale data
- Predictable save/refresh cycle

## Cache Invalidation Flow (Now Working Properly)

1. **User clicks Save** → `InlineWysiwygEditor.handleSave()`
2. **Save to API** → `WelcomeMessage.handleSave()` → `/api/documents/:slug` PUT
3. **Clear localStorage** → `clearAllDocumentCaches()` removes all `docutrain-documents-cache-*` keys
4. **Dispatch event** → `window.dispatchEvent(new Event('document-updated'))`
5. **Refetch triggered** → `useDocumentConfig` listens and calls `loadConfig(true)`
6. **Clear in-memory caches** → `configCache.delete(cacheKey)`, `errorCache.delete(documentSlug)`
7. **Fetch fresh data** → API call with `forceRefresh=true`
8. **Update component** → New `value` prop flows to `InlineWysiwygEditor`
9. **Display updates** → Component shows fresh data immediately

## Testing Performed

### Test Case 1: Bold Text Persistence
✅ Save bold text → Displays immediately without cache clear

### Test Case 2: Link Insertion
✅ Insert link → Saves → Displays with `target="_blank"` immediately

### Test Case 3: Multiple Edits
✅ Edit → Save → Edit again → Save → All changes persist

### Test Case 4: Browser Refresh
✅ Save → Refresh page → Changes persist (no stale cache)

## Related Files Modified

- `app-src/src/components/Chat/InlineWysiwygEditor.tsx`
  - Removed `displayValue`, `justSaved`, `savedValue` state
  - Simplified `useEffect` for value updates
  - Simplified `handleSave` to remove optimistic updates
  - Updated display to use `value` prop directly

## Cache Layers (For Reference)

The app uses multiple cache layers:

1. **localStorage** (`docutrain-documents-cache-*`)
   - 5-minute TTL
   - Cleared by `clearAllDocumentCaches()`

2. **In-memory Map** (`configCache`, `errorCache`)
   - Module-level caches in `useDocumentConfig`
   - Cleared on `document-updated` event

3. **Component State** (`value` prop)
   - Now directly used without intermediate state
   - Updates automatically when parent refetches

## Future Considerations

1. **Loading State**: Consider adding a brief loading indicator during the refetch to provide visual feedback that the save is processing.

2. **Error Handling**: If the refetch fails, the component will show the old value. Consider adding error recovery logic.

3. **Debouncing**: For auto-save features, consider debouncing to avoid excessive API calls.

4. **Conflict Resolution**: If multiple users edit the same document, consider adding conflict detection/resolution.

## Notes for Developers

- **Don't add optimistic updates** to inline editors - trust the cache invalidation system
- **The `document-updated` event** is the source of truth for when to refetch
- **localStorage caching** is handled by `clearAllDocumentCaches()` - don't manually clear specific keys
- **The `value` prop** is always the source of truth for display - don't maintain separate display state

## Related Documentation

- `/docs/performance/CACHE-MANAGEMENT.md` - Overview of all cache layers
- `/docs/bug-fixes/WYSIWYG-BOLD-AND-LINK-FIX.md` - Related WYSIWYG fixes

