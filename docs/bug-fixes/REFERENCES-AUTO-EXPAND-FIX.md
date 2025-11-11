# References Auto-Expand and Toggle Disappear Fix

## Problem

When users asked a new question in the chat, references from previous messages would automatically expand, and the collapse/expand toggle button would disappear. This occurred without any user interaction - simply starting a new chat would cause previous references to expand and lose their toggle functionality.

### Root Cause

The issue was caused by React's `dangerouslySetInnerHTML` completely replacing the DOM on every render:

1. **Initial State**: References were correctly styled with containers and toggle buttons added post-render via `styleReferences()`
2. **New Question Triggered**: When a new question was asked, React re-rendered all message components
3. **DOM Destruction**: `dangerouslySetInnerHTML` completely wiped out and replaced the entire innerHTML of each message
4. **Loss of Styled Elements**: This destroyed:
   - The carefully styled references containers
   - The toggle buttons
   - The collapsed/expanded state
5. **Recreation Failure**: Even though `styleReferences()` was called again, the timing and state management issues prevented proper restoration

## Solution

The fix involved replacing `dangerouslySetInnerHTML` with a ref callback that manually manages `innerHTML` and only updates it when content actually changes.

### 1. Added `htmlSetRef` to Track innerHTML State

A ref was added to track whether innerHTML has been manually set:

```typescript
const htmlSetRef = useRef<boolean>(false); // Track if we've set innerHTML manually
```

### 2. Replaced `dangerouslySetInnerHTML` with Ref Callback

Instead of using `dangerouslySetInnerHTML`, we now use a ref callback that conditionally sets innerHTML:

```typescript
// Ref callback to set innerHTML only when content changes
// This prevents React from destroying our styled references containers
const setContentRef = (node: HTMLDivElement | null) => {
  if (node) {
    contentRef.current = node;
    // Only set innerHTML if content has changed
    if (content !== previousContentRef.current) {
      node.innerHTML = html as string;
      htmlSetRef.current = true;
    } else if (!htmlSetRef.current) {
      // First render - set innerHTML
      node.innerHTML = html as string;
      htmlSetRef.current = true;
    }
    // Otherwise skip - content unchanged, preserve DOM
  }
};

return (
  <div className="message-content-wrapper">
    <div
      ref={setContentRef}
      className="message-content"
    />
    {/* ... rest of component ... */}
  </div>
);
```

### 3. State Preservation via `useLayoutEffect`

A `useLayoutEffect` hook saves the collapsed/expanded state after every render to keep it fresh:

```typescript
// Save state immediately whenever the DOM might change
// This effect runs after every render and saves the current state
useLayoutEffect(() => {
  if (!contentRef.current || role !== 'assistant' || !content || isStreaming) return;
  
  const containers = contentRef.current.querySelectorAll('.references-container');
  if (containers.length === 0) return;
  
  const stateKey = getStateKey();
  let stateMap = globalCollapsedState.get(stateKey);
  if (!stateMap) {
    stateMap = new Map();
    globalCollapsedState.set(stateKey, stateMap);
  }
  
  containers.forEach((container, index) => {
    const contentWrapper = container.querySelector('.references-content');
    const toggle = container.querySelector('.references-toggle');
    if (contentWrapper && toggle) {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      stateMap.set(index, isExpanded);
    }
  });
}); // NO dependencies - runs after EVERY render to keep state fresh
```

### 4. State Keyed by Message ID

The state is now keyed by `messageId` instead of content hash, ensuring each message maintains its own state:

```typescript
// Get state key - use messageId if available, otherwise fall back to content hash
const getStateKey = () => {
  if (messageId) {
    return messageId;
  }
  // Fallback to content hash if no messageId provided
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
};
```

## How It Works

1. **First Message Renders**: 
   - Ref callback sets innerHTML (first render)
   - `styleReferences()` creates containers and toggle buttons
   - References start collapsed by default
   - `useLayoutEffect` saves state to `globalCollapsedState` map

2. **User Expands References**:
   - Toggle button updates DOM classes and aria-expanded attribute
   - `useLayoutEffect` saves expanded state to global map

3. **New Question Asked**:
   - React re-renders all message components
   - **Key Difference**: Ref callback checks if content changed
   - For unchanged messages: innerHTML is NOT updated → DOM is preserved
   - Styled references containers and toggle buttons remain intact
   - State is restored from `globalCollapsedState` map

4. **New Message Streaming**:
   - New message gets its own `messageId`
   - Creates its own containers when streaming completes
   - Doesn't affect previous messages' DOM

## Files Modified

- `app-src/src/components/Chat/MessageContent.tsx`
  - Added `htmlSetRef` to track innerHTML state
  - Replaced `dangerouslySetInnerHTML` with `setContentRef` ref callback
  - Updated `getStateKey()` to use `messageId` instead of content hash
  - Added `useLayoutEffect` to save state after every render
  - Updated `MessageContentProps` interface to include `messageId`

- `app-src/src/pages/ChatPage.tsx`
  - Updated to pass `messageId={msg.id}` to `MessageContent` component

- `app-src/src/pages/SharedConversationPage.tsx`
  - Updated to pass `messageId={msg.id}` to `MessageContent` component

## Testing

To verify the fix works:

1. Ask a question that generates a response with references
2. Verify references start collapsed with toggle button visible
3. Click toggle to expand references
4. Ask a new question (or click a Recent Question)
5. Verify that:
   - Previous message's references remain in their current state (expanded/collapsed)
   - Toggle button remains visible and functional
   - New message's references start collapsed
   - No auto-expansion occurs without user interaction

## Related Components

- **Global State Management**: Uses `globalCollapsedState` Map keyed by `messageId` to persist collapsed state across re-renders
- **State Restoration**: `restoreCollapsedState()` function restores saved state from the global map
- **Container Creation**: `styleReferences()` from `messageStyling.ts` creates the reference containers (already idempotent)
- **Message ID**: Each message now has a unique `messageId` that persists across re-renders

## Key Technical Details

### Why Ref Callback Instead of dangerouslySetInnerHTML?

- **`dangerouslySetInnerHTML`**: React completely replaces innerHTML on every render, destroying any DOM modifications made post-render
- **Ref Callback**: We control when innerHTML is updated, allowing us to preserve the DOM when content hasn't changed

### State Management Strategy

- **Message ID as Key**: Using `messageId` ensures each message maintains its own state, even if content is similar
- **Continuous State Saving**: `useLayoutEffect` with no dependencies runs after every render, keeping state fresh
- **State Restoration**: Multiple `useLayoutEffect` hooks ensure state is restored at the right times

### Performance Considerations

- **Conditional innerHTML Updates**: Only updates DOM when content actually changes, reducing unnecessary DOM manipulation
- **Fast Path**: Existing containers are detected and state is restored without recreating containers
- **Streaming Optimization**: During streaming, minimal DOM manipulation occurs

## Notes

- This fix prevents React from destroying styled DOM elements on re-renders
- The ref callback approach is more performant than `dangerouslySetInnerHTML` for this use case
- State is preserved per message using `messageId`, ensuring each message maintains its own collapsed/expanded state
- The fix works seamlessly with the existing `styleReferences()` function which already had idempotent checks
- All debug logging was removed after confirming the fix works correctly

