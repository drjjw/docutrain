# References Collapse After Copy Fix

## Problem

When users clicked the copy button in an AI response that included references, the references container would expand and remain expanded after copying. Additionally, the collapse icon (toggle button) would disappear, preventing users from manually collapsing the references section.

### Root Cause

The issue occurred because:

1. When `setIsCopied(true)` triggered a React re-render, React replaced the entire HTML content via `dangerouslySetInnerHTML`
2. This destroyed all the reference containers and their toggle buttons
3. The `useEffect` hook responsible for recreating containers didn't run because its dependencies (`content`, `role`, `isStreaming`, `showReferences`) hadn't changed
4. Even when containers were recreated, the collapsed state wasn't being restored properly

## Solution

The fix involved three key changes:

### 1. Added `collapseAllReferences()` Helper Function

This function programmatically collapses all reference containers and updates the global state:

```typescript
const collapseAllReferences = () => {
  if (!contentRef.current) return;
  
  const containers = contentRef.current.querySelectorAll('.references-container');
  const contentHash = getContentHash();
  let stateMap = globalCollapsedState.get(contentHash);
  if (!stateMap) {
    stateMap = new Map();
    globalCollapsedState.set(contentHash, stateMap);
  }
  
  containers.forEach((container, index) => {
    const contentWrapper = container.querySelector('.references-content');
    const toggle = container.querySelector('.references-toggle');
    const plusIcon = toggle?.querySelector('.plus') as HTMLElement;
    const minusIcon = toggle?.querySelector('.minus') as HTMLElement;
    
    if (contentWrapper && toggle) {
      // Collapse the container
      contentWrapper.classList.remove('expanded');
      contentWrapper.classList.add('collapsed');
      toggle.setAttribute('aria-expanded', 'false');
      if (plusIcon) plusIcon.style.display = '';
      if (minusIcon) minusIcon.style.display = 'none';
      
      // Update global state to reflect collapsed state
      stateMap.set(index, false);
    }
  });
};
```

### 2. Updated `handleCopy()` to Collapse After Copying

The copy handler now calls `collapseAllReferences()` after copying content to clipboard:

```typescript
const handleCopy = async () => {
  // ... copy logic ...
  
  // Collapse all references containers after copying
  collapseAllReferences();
  
  setIsCopied(true);
  setTimeout(() => setIsCopied(false), 2000);
};
```

### 3. Added `useLayoutEffect` to Restore State After Re-renders

A new `useLayoutEffect` hook ensures state is restored after any render that might have replaced HTML (e.g., when `isCopied` changes):

```typescript
// Restore state after any render that might have replaced HTML (e.g., when isCopied changes)
useLayoutEffect(() => {
  if (!contentRef.current || role !== 'assistant' || !content || isStreaming || !showReferences) return;
  
  // Check if containers exist - if not, useEffect will create them
  const containers = contentRef.current.querySelectorAll('.references-container');
  if (containers.length > 0) {
    // Containers exist - restore their state immediately
    restoreCollapsedState(containers);
  }
}, [isCopied, content, role, isStreaming, showReferences]);
```

### 4. Updated `useEffect` Dependencies

Added `isCopied` to the `useEffect` dependencies so it runs when the copy state changes, ensuring containers are recreated and state is restored:

```typescript
useEffect(() => {
  // ... styling logic ...
  
  // If containers don't exist but should (showReferences is true), we need to create them
  // This handles the case where React replaced HTML (e.g., when isCopied changed)
  const needsContainerCreation = showReferences && !existingContainer;
  
  if (showReferences) {
    styleReferences(contentRef.current);
    const containers = contentRef.current.querySelectorAll('.references-container');
    if (containers.length > 0) {
      restoreCollapsedState(containers);
    }
  }
}, [content, role, isStreaming, showReferences, isCopied]); // Added isCopied
```

## How It Works

1. **User clicks copy** → `collapseAllReferences()` saves collapsed state to `globalCollapsedState` map
2. **`setIsCopied(true)` triggers re-render** → React replaces HTML via `dangerouslySetInnerHTML`, destroying containers
3. **`useEffect` runs** (because `isCopied` changed) → Detects no containers → Creates them via `styleReferences()` → Restores collapsed state
4. **`useLayoutEffect` also runs** → Acts as a safety net to restore state if containers exist

## Files Modified

- `app-src/src/components/Chat/MessageContent.tsx`
  - Added `collapseAllReferences()` helper function
  - Updated `handleCopy()` to call `collapseAllReferences()` after copying
  - Added `useLayoutEffect` hook to restore state after re-renders
  - Added `isCopied` to `useEffect` dependencies

## Testing

To verify the fix works:

1. Open an AI response that includes references
2. Expand the references section
3. Click the copy button
4. Verify that:
   - References automatically collapse after copying
   - The collapse/expand toggle button remains visible and functional
   - The collapsed state persists correctly

## Related Components

- **Global State Management**: Uses `globalCollapsedState` Map to persist collapsed state across re-renders
- **State Restoration**: `restoreCollapsedState()` function restores saved state from the global map
- **Container Creation**: `styleReferences()` from `messageStyling.ts` creates the reference containers

## Notes

- The fix ensures that references always start collapsed after copying, regardless of their previous state
- The global state map uses content hash as the key to persist state per message
- Both `useEffect` and `useLayoutEffect` work together to ensure containers are created and state is restored correctly

