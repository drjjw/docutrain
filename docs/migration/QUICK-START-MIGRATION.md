# Quick Start: React Chat Migration

## Step 1: Test React Version (Side-by-Side)

You now have both versions:

- **Vanilla JS**: `http://localhost:3458/chat?doc=smh`
- **React version**: `http://localhost:3458/app/chat?doc=smh`

Test both and compare behavior!

## Step 2: Add Feature Flag (Optional)

To gradually switch traffic, add this to `server.js`:

```javascript
// Feature flag for React chat (environment variable)
const ENABLE_REACT_CHAT = process.env.ENABLE_REACT_CHAT === 'true';

// In /chat route handler:
app.get('/chat', async (req, res) => {
  // Check if user wants React version
  const useReact = req.query.react === 'true' || 
                   ENABLE_REACT_CHAT;
  
  if (useReact) {
    // Redirect to React version (already handled by /app/* route)
    return res.redirect(`/app/chat?${req.url.split('?')[1] || ''}`);
  }
  
  // Serve vanilla JS version (existing code)
  // ... rest of existing /chat handler
});
```

Then test with:
- Vanilla JS: `/chat?doc=smh`
- React: `/chat?react=true&doc=smh` (or set env var)

## Step 3: Port Features One by One

The ChatPage.tsx I created has:
- ✅ Basic structure
- ✅ Message input/output
- ✅ Streaming response
- ✅ Session management

Still need to port from vanilla JS:
- [ ] Document selector UI
- [ ] Auto-scroll behavior
- [ ] Message styling (references, citations)
- [ ] Multi-document support
- [ ] Real-time document switching
- [ ] Error handling UI
- [ ] Loading states
- [ ] Mobile responsiveness

## Step 4: Compare & Test

Open both versions side-by-side:
1. Test same query on both
2. Compare responses
3. Compare UI/UX
4. Note any differences
5. Fix React version to match

## Step 5: Gradually Increase Traffic

Once React version matches vanilla JS:
1. Start with 1% of users (random selection)
2. Monitor for errors
3. Increase to 10%, then 50%, then 100%
4. Remove vanilla JS route when confident

## Current Status

✅ **Basic React chat page created**
- Located: `app-src/src/pages/ChatPage.tsx`
- Route: `/app/chat`
- Status: **Alpha** - needs feature parity

🔄 **Next steps:**
1. Port document selector component
2. Port message styling
3. Port auto-scroll logic
4. Test thoroughly
5. Gradually roll out



