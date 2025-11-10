# Logging Standards

**Last Updated:** January 2025  
**Status:** ✅ Active

## Overview

This project uses conditional debug logging to keep production logs clean while maintaining debugging capabilities in development.

## Rules for New Code

### ✅ DO: Use Conditional Debug Logging

**Frontend (React/TypeScript):**
```typescript
import { debugLog, debugWarn, debugError } from '@/utils/debug';

// ✅ CORRECT - Debug logging
debugLog('User clicked button:', buttonId);
debugWarn('API response slower than expected');
debugError('Failed to fetch data:', error);
```

**Backend (Node.js):**
```javascript
const { debugLog, debugWarn, debugError } = require('../utils/debug');

// ✅ CORRECT - Debug logging
debugLog('Processing request:', requestId);
debugWarn('Rate limit approaching');
debugError('Database query failed:', error);
```

### ❌ DON'T: Use Direct Console Logging for Debug

```typescript
// ❌ WRONG - Will always log, even in production
console.log('User clicked button:', buttonId);
console.warn('API response slower than expected');
```

### ✅ DO: Use Console for Operational Logs

**Operational logs** (logs that should always appear, even in production) should use `console.log`, `console.error`, or `console.warn` directly:

```javascript
// ✅ CORRECT - Operational log (always visible)
console.log(`[Processing ${userDocId}] [${method}] ${stage}:${status} - ${message}`);

// ✅ CORRECT - Error that should always be logged
console.error('❌ Critical error:', error);
```

## When to Use What

| Log Type | Use | Example |
|----------|-----|---------|
| **Debug Info** | `debugLog()` | "User clicked button", "API call started", "State updated" |
| **Debug Warnings** | `debugWarn()` | "Rate limit approaching", "Cache miss", "Retry attempt" |
| **Debug Errors** | `debugError()` | "Non-critical error", "Validation failed", "Fallback used" |
| **Operational Logs** | `console.log()` | `[Processing]` prefixed logs, monitoring metrics |
| **Critical Errors** | `console.error()` | Unhandled exceptions, system failures |
| **Production Warnings** | `console.warn()` | Deprecation notices, security warnings |

## Debug Mode Behavior

### Frontend
- **Development mode** (`npm run dev:app`): Debug logs **ON** by default
- **Production build** (`npm run build:app`): Debug logs **OFF** by default
- **Override**: Set `VITE_DEBUG=true` or `VITE_DEBUG=false` in `.env` before building

### Backend
- **Development mode** (`NODE_ENV=development`): Debug logs **ON** by default
- **Production mode** (`NODE_ENV=production`): Debug logs **OFF** by default
- **Override**: Set `DEBUG=true` in `.env` to enable in production

## Examples

### ✅ Good: Conditional Debug Logging

```typescript
// Frontend component
const handleClick = () => {
  debugLog('Button clicked:', buttonId);
  // ... rest of logic
};
```

```javascript
// Backend route handler
app.post('/api/endpoint', (req, res) => {
  debugLog('Request received:', req.body);
  // ... rest of logic
});
```

### ❌ Bad: Direct Console Logging

```typescript
// ❌ This will always log, even in production
const handleClick = () => {
  console.log('Button clicked:', buttonId);
  // ... rest of logic
};
```

### ✅ Good: Operational Logging

```javascript
// ✅ Operational log - should always appear
console.log(`[Processing ${userDocId}] Starting document processing`);
```

## Migration Checklist

When adding new code:
- [ ] Use `debugLog()` instead of `console.log()` for debug statements
- [ ] Use `debugWarn()` instead of `console.warn()` for debug warnings
- [ ] Use `debugError()` instead of `console.error()` for debug errors
- [ ] Keep `console.error()` for critical errors that must always log
- [ ] Keep `console.log()` for operational monitoring logs (e.g., `[Processing]` prefix)

## Quick Reference

**Frontend imports:**
```typescript
import { debugLog, debugWarn, debugError } from '@/utils/debug';
```

**Backend imports:**
```javascript
const { debugLog, debugWarn, debugError } = require('../utils/debug');
```

---

**Remember:** Debug logs are for development. Operational logs are for production monitoring.



