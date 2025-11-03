# Gradual Migration: Vanilla JS Chat → React Chat

## Strategy: Feature Flag + Parallel Routes

The key is to run both versions side-by-side and gradually switch traffic.

## Phase 1: Add React Chat Route (Parallel Running)

### Step 1: Create Feature Flag System

Add to `server.js`:
```javascript
// Feature flags (via environment variable)
const ENABLE_REACT_CHAT = process.env.ENABLE_REACT_CHAT === 'true' || false;
const REACT_CHAT_BETA_USERS = (process.env.REACT_CHAT_BETA_USERS || '').split(',').filter(Boolean);
```

### Step 2: Add React Chat Route

Update `server.js` to serve React chat at new route:
```javascript
// Serve React chat interface (if enabled)
if (ENABLE_REACT_CHAT) {
  // React app already handles /app/* routes
  // Just add /chat route that serves React version
  app.get('/chat-react', async (req, res) => {
    // Serve React app's chat page
    const reactChatPath = path.join(__dirname, 'dist/app/index.html');
    res.sendFile(reactChatPath);
  });
}
```

### Step 3: Create React ChatPage Component

Create `app-src/src/pages/ChatPage.tsx`:
```typescript
// Start with a basic wrapper that mirrors vanilla JS functionality
// Port one feature at a time
```

### Step 4: Add Route to AppRouter

```typescript
// In AppRouter.tsx
<Route
  path="/chat"
  element={<ProtectedRoute><ChatPage /></ProtectedRoute>}
/>
```

## Phase 2: Component-by-Component Migration

### Strategy: Port Features Incrementally

1. **Start with Simple Features**
   - Document selector (already has React version?)
   - User menu
   - Basic UI shell

2. **Then Core Features**
   - Chat input
   - Message history
   - Streaming response

3. **Finally Complex Features**
   - Document switching
   - Multi-document support
   - Real-time updates

### Pattern: Wrapper Components

For each feature, create a React component that:
1. Matches vanilla JS behavior exactly
2. Uses same API calls
3. Can be tested independently

Example:
```typescript
// app-src/src/components/Chat/ChatInterface.tsx
export function ChatInterface() {
  // Port from public/js/chat.js
  // Keep API calls identical
  // Match behavior exactly
}
```

## Phase 3: Traffic Splitting

### Option A: URL Parameter Switch
```javascript
// In server.js
app.get('/chat', async (req, res) => {
  const useReact = req.query.react === 'true' || 
                   REACT_CHAT_BETA_USERS.includes(req.query.user_id);
  
  if (useReact && ENABLE_REACT_CHAT) {
    return res.redirect('/app/chat?react=true');
  }
  
  // Serve vanilla JS version
  // ... existing code
});
```

### Option B: Cookie-Based Switch
```javascript
// Check cookie to determine which version
const chatVersion = req.cookies.chat_version || 'vanilla';
if (chatVersion === 'react' && ENABLE_REACT_CHAT) {
  // Serve React version
}
```

### Option C: Gradual Rollout
```javascript
// 10% of users get React version
const userId = extractUserId(req);
const hash = hashUserId(userId);
const useReact = (hash % 100) < 10; // 10% rollout
```

## Phase 4: Migration Checklist

### ✅ Pre-Migration Setup
- [ ] Feature flag system
- [ ] React chat route created
- [ ] Basic ChatPage component structure
- [ ] Route added to AppRouter

### ✅ Phase 1: Basic Shell
- [ ] Document selector ported
- [ ] User menu integrated
- [ ] Layout matches vanilla JS
- [ ] Basic routing works

### ✅ Phase 2: Core Chat
- [ ] Message input ported
- [ ] Message history display
- [ ] Streaming response working
- [ ] Session management

### ✅ Phase 3: Advanced Features
- [ ] Document switching
- [ ] Multi-document support
- [ ] Real-time updates
- [ ] Error handling

### ✅ Phase 4: Polish
- [ ] Mobile responsive
- [ ] Accessibility
- [ ] Performance optimization
- [ ] Feature parity verified

### ✅ Phase 5: Cutover
- [ ] Monitor for 1 week with 10% traffic
- [ ] Increase to 50% traffic
- [ ] Full rollout
- [ ] Remove vanilla JS route

## Testing Strategy

### At Each Phase:
1. **Side-by-side comparison**
   - Open vanilla JS: `/chat?doc=smh`
   - Open React version: `/app/chat?doc=smh`
   - Compare behavior

2. **Automated testing**
   - API calls should be identical
   - Responses should match
   - State management should be equivalent

3. **User acceptance testing**
   - Have beta users test React version
   - Collect feedback
   - Fix issues before proceeding

## Rollback Plan

Always keep vanilla JS route active until:
- React version has 100% feature parity
- No critical bugs for 2+ weeks
- Performance is equal or better

If issues arise:
1. Flip feature flag OFF
2. All traffic routes to vanilla JS
3. Fix issues in React version
4. Re-enable when ready

## Code Organization

### Keep API Layer Shared
```typescript
// app-src/src/services/chatApi.ts
// Same API calls as vanilla JS version
// Both use same backend endpoints
```

### Extract Shared Logic
```typescript
// app-src/src/utils/chatUtils.ts
// Business logic shared between vanilla JS and React
// Or ported directly from vanilla JS
```

### Component Structure
```
app-src/src/
  pages/
    ChatPage.tsx          # Main chat page
  components/
    Chat/
      ChatInterface.tsx   # Main chat UI
      MessageList.tsx     # Message display
      MessageInput.tsx     # Input component
      DocumentSelector.tsx # Document selection
  hooks/
    useChat.ts           # Chat state management
    useStreaming.ts      # Streaming response
    useDocument.ts       # Document management
```

## Migration Timeline

**Week 1-2:** Setup + Basic Shell
- Feature flags
- Route setup
- Basic ChatPage structure

**Week 3-4:** Core Chat Features
- Message input/output
- Streaming
- History

**Week 5-6:** Advanced Features
- Document switching
- Multi-doc
- Polish

**Week 7-8:** Testing & Rollout
- Beta testing
- Gradual rollout
- Monitor & fix

**Week 9+:** Full Migration
- 100% traffic to React
- Remove vanilla JS
- Cleanup

## Key Principles

1. **Never break production** - Keep vanilla JS working
2. **Test at each step** - Don't move forward until current step works
3. **Feature parity first** - Don't add new features during migration
4. **Incremental changes** - Small PRs, frequent deploys
5. **Easy rollback** - Feature flag = instant rollback
6. **Monitor closely** - Watch for errors, performance issues

