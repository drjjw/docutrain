# Security Review - January 2025

**Date:** January 2025  
**Status:** Review Complete - Action Items Identified

## Executive Summary

Overall security posture is **good** with solid authentication, file validation, and rate limiting on chat endpoints. However, several **medium-to-high priority** security issues were identified that should be addressed, particularly around XSS prevention, monitoring route protection, and error message sanitization.

---

## ✅ Security Strengths

### 1. Authentication & Authorization
- ✅ JWT-based authentication with Supabase
- ✅ Proper token validation on protected routes
- ✅ Row Level Security (RLS) policies implemented
- ✅ Multi-tier permission system (registered users, owner admins, super admins)
- ✅ Authenticated Supabase clients for RLS-compliant operations

### 2. File Upload Security
- ✅ File type validation (PDF only)
- ✅ File size limits (50MB regular, 75MB superadmin)
- ✅ Filename sanitization (`sanitizeFileName` function)
- ✅ Proper storage path construction

### 3. Rate Limiting
- ✅ Implemented on chat endpoints (`/api/chat`, `/api/chat/stream`)
- ✅ Dual-layer approach (backend + frontend)
- ✅ Session-based tracking
- ✅ Sliding window algorithm

### 4. Input Validation
- ✅ File validation utilities
- ✅ Page number validation
- ✅ File path validation
- ✅ Processing options validation

### 5. Database Security
- ✅ Using Supabase client (prevents SQL injection)
- ✅ RLS policies in place
- ✅ Service role key properly scoped

---

## 🔴 Critical Issues

### 1. Command Injection in Monitoring Routes

**Location:** `lib/routes/monitoring.js:103`

**Issue:**
```javascript
const { stdout, stderr } = await execPromise(`pm2 logs ${appName} --lines ${lines} --nostream`);
```

The `appName` variable comes from `req.query.app` and is directly interpolated into a shell command without sanitization.

**Risk:** HIGH - An attacker could execute arbitrary commands on the server.

**Attack Example:**
```
GET /api/monitoring/pm2/logs?app=docutrainio-bot; rm -rf /
```

**Fix:** ✅ **FIXED** - Implemented in `lib/routes/monitoring.js`

```javascript
// Whitelist of allowed PM2 process names to prevent command injection
const ALLOWED_PM2_PROCESSES = ['docutrainio-bot', 'brightbean-bot', 'manual-bot'];

// Validate appName against whitelist
if (!ALLOWED_PM2_PROCESSES.includes(appName)) {
    return res.status(400).json({
        success: false,
        error: `Invalid process name. Allowed processes: ${ALLOWED_PM2_PROCESSES.join(', ')}`
    });
}

// Use execFile with parameterized arguments (safer than exec - doesn't spawn shell)
const { stdout, stderr } = await execFilePromise('pm2', [
    'logs',
    appName,
    '--lines',
    String(lines),
    '--nostream'
]);
```

**Changes Made:**
1. ✅ Added `ALLOWED_PM2_PROCESSES` whitelist constant
2. ✅ Added validation check against whitelist before execution
3. ✅ Switched from `exec` to `execFile` (doesn't spawn shell, safer)
4. ✅ Added validation for `lines` parameter (1-10000 range)
5. ✅ Updated auto-detection to only use whitelisted processes

**Priority:** 🔴 CRITICAL - ✅ **FIXED**

---

### 2. XSS Vulnerability via dangerouslySetInnerHTML

**Location:** Multiple files using `dangerouslySetInnerHTML` without sanitization

**Affected Files:**
- `app-src/src/components/Admin/OwnerSettings/index.tsx:175`
- `app-src/src/components/Chat/MessageContent.tsx:536`
- `app-src/src/components/Chat/WelcomeMessage.tsx:124`
- `app-src/src/components/Admin/DocumentEditorModal/DocumentMessagesCard.tsx:41,63`

**Issue:**
HTML content from user input (intro messages, welcome messages) is rendered directly without sanitization:

```tsx
<div dangerouslySetInnerHTML={{ __html: introMessage }} />
```

The `WysiwygEditor` component allows HTML input but doesn't sanitize before storage or rendering.

**Risk:** HIGH - Stored XSS attacks possible. An admin could inject malicious scripts that execute for all users viewing documents.

**Attack Example:**
```html
<script>
  fetch('/api/users', {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  }).then(r => r.json()).then(data => {
    // Exfiltrate user data
  });
</script>
```

**Fix:**
1. Install DOMPurify: `npm install dompurify @types/dompurify`
2. Sanitize before rendering:
```tsx
import DOMPurify from 'dompurify';

<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(introMessage) }} />
```
3. Sanitize before storage in WysiwygEditor component

**Priority:** 🔴 CRITICAL - Fix immediately

---

## 🟡 High Priority Issues

### 3. Monitoring Routes Unprotected by Default

**Location:** `lib/routes/monitoring.js:17-24`

**Issue:**
```javascript
function requireMonitoringAuth(req, res, next) {
    const monitoringPassword = process.env.MONITORING_PASSWORD;
    
    // If no password is set, allow access (for development)
    if (!monitoringPassword) {
        console.warn('⚠️  MONITORING_PASSWORD not set - monitoring routes are unprotected');
        return next(); // ⚠️ Allows access without authentication
    }
```

**Risk:** HIGH - Exposes sensitive system information:
- PM2 process status and logs
- System resource usage
- Database connection details
- Stuck document information
- Processing statistics

**Fix:**
```javascript
function requireMonitoringAuth(req, res, next) {
    const monitoringPassword = process.env.MONITORING_PASSWORD;
    const isProduction = process.env.NODE_ENV === 'production';
    
    // In production, require password. In dev, allow if explicitly set to empty string
    if (isProduction && !monitoringPassword) {
        return res.status(503).json({
            success: false,
            error: 'Monitoring disabled - MONITORING_PASSWORD not configured'
        });
    }
    
    if (!monitoringPassword) {
        console.warn('⚠️  MONITORING_PASSWORD not set - monitoring routes are unprotected');
        return next();
    }
    
    // ... rest of auth logic
}
```

**Priority:** 🟡 HIGH - Fix before production deployment

---

### 4. Error Messages Leak Sensitive Information

**Location:** `server.js:193-211`

**Issue:**
```javascript
app.use('/api', (err, req, res, next) => {
    // ...
    res.status(err.status || 500).json({ 
        success: false, 
        error: err.message || 'Internal server error',
        code: err.code || null,        // ⚠️ Database error codes
        details: err.details || null,  // ⚠️ Database error details
        hint: err.hint || null         // ⚠️ Database hints
    });
});
```

**Risk:** MEDIUM-HIGH - PostgreSQL error codes, details, and hints can reveal:
- Database schema structure
- Column names
- Constraint violations
- Internal query structure

**Example Leaked Error:**
```json
{
  "error": "duplicate key value violates unique constraint",
  "code": "23505",
  "details": "Key (email)=(user@example.com) already exists.",
  "hint": "Consider using ON CONFLICT clause"
}
```

**Fix:**
```javascript
app.use('/api', (err, req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Log full error details server-side
    console.error('❌ API Error:', err);
    console.error('   Path:', req.path);
    console.error('   Method:', req.method);
    console.error('   Stack:', err.stack);
    
    if (!res.headersSent) {
        // In production, sanitize error messages
        const sanitizedError = isProduction 
            ? sanitizeError(err)
            : {
                success: false,
                error: err.message || 'Internal server error',
                code: err.code || null,
                details: err.details || null,
                hint: err.hint || null
            };
        
        res.status(err.status || 500).json(sanitizedError);
    }
});

function sanitizeError(err) {
    // Don't expose database error codes/details in production
    if (err.code && err.code.match(/^[0-9]{5}$/)) {
        // PostgreSQL error code - sanitize
        return {
            success: false,
            error: 'A database error occurred. Please try again or contact support.',
        };
    }
    
    // For known application errors, return safe message
    const safeMessage = err.message || 'An error occurred';
    
    return {
        success: false,
        error: safeMessage
    };
}
```

**Priority:** 🟡 HIGH - Fix before production

---

## 🟢 Medium Priority Issues

### 5. CORS Allows All Origins

**Location:** `lib/middleware.js:19-23`

**Issue:**
```javascript
cors({
    origin: '*',
    credentials: true
}),
```

**Risk:** MEDIUM - While intentional for embedding, this allows any domain to make authenticated requests if credentials are leaked.

**Current State:** Acceptable if embedding is a core feature, but should be documented.

**Recommendation:**
- Document this as intentional design decision
- Consider implementing origin whitelist if embedding domains are known
- Ensure credentials are properly scoped

**Priority:** 🟢 MEDIUM - Document decision

---

### 6. Missing Rate Limiting on Non-Chat Endpoints

**Location:** Various upload/processing endpoints

**Issue:**
Rate limiting is only implemented on chat endpoints (`/api/chat`, `/api/chat/stream`). Other endpoints lack rate limiting:
- `/api/upload-document`
- `/api/upload-text`
- `/api/process-document`
- `/api/users/*` (admin endpoints)

**Risk:** MEDIUM - Potential for:
- Resource exhaustion via rapid uploads
- DoS attacks on processing endpoints
- Brute force attempts on admin endpoints

**Fix:**
Implement rate limiting middleware for:
- Upload endpoints: 5 requests per minute per user
- Processing endpoints: 3 requests per minute per user
- Admin endpoints: 10 requests per minute per user

**Priority:** 🟢 MEDIUM - Implement when time permits

---

### 7. Service Role Key Fallback Behavior

**Location:** `server.js:110-119`

**Issue:**
```javascript
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
```

**Risk:** LOW-MEDIUM - Falls back to ANON key if SERVICE_ROLE_KEY not set, which can cause RLS issues and unexpected behavior.

**Current State:** Has warning log, but should fail fast in production.

**Fix:**
```javascript
const isProduction = process.env.NODE_ENV === 'production';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (isProduction && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY not set in production!');
    process.exit(1);
}
```

**Priority:** 🟢 MEDIUM - Improve error handling

---

## 📋 Action Items Checklist

### Immediate (Critical)
- [x] Fix command injection in monitoring routes ✅ **FIXED** (2025-01-XX)
- [ ] Implement HTML sanitization for XSS prevention
- [ ] Add DOMPurify to sanitize all `dangerouslySetInnerHTML` usage

### High Priority
- [ ] Protect monitoring routes in production
- [ ] Sanitize error messages in production
- [ ] Add environment-based error handling

### Medium Priority
- [ ] Document CORS policy decision
- [ ] Add rate limiting to upload/processing endpoints
- [ ] Improve service role key validation

### Low Priority / Future
- [ ] Security headers audit (CSP, X-Frame-Options, etc.)
- [ ] Dependency vulnerability scanning
- [ ] Penetration testing
- [ ] Security monitoring/alerting

---

## 🔍 Additional Security Considerations

### Positive Findings
1. **No SQL Injection Risk** - Using Supabase client with parameterized queries
2. **Proper File Validation** - Comprehensive file type and size checks
3. **Authentication Flow** - Well-implemented JWT validation
4. **RLS Policies** - Database-level access control in place

### Areas to Monitor
1. **Dependency Updates** - Regularly update npm packages for security patches
2. **API Key Management** - Ensure all API keys are in environment variables
3. **Logging** - Review logs for sensitive data leakage
4. **Session Management** - Monitor session token expiration and refresh

---

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)

---

## Notes

- Review conducted: January 2025
- Codebase version: Current main branch
- Next review recommended: After implementing critical fixes

---

**Reviewer Notes:** Overall security posture is solid with good authentication and validation practices. The identified issues are fixable and don't indicate systemic security problems. Priority should be given to XSS prevention and monitoring route protection.

