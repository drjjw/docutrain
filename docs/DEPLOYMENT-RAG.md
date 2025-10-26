# RAG Enhancement Deployment Guide

Complete instructions for deploying the RAG-enhanced PDF chatbot to production.

## 🎯 Deployment Overview

This deployment includes:
- ✅ Existing Full Doc mode (unchanged)
- ✅ New RAG mode with vector search
- ✅ Supabase pgvector database (already configured)
- ✅ 360 embedded chunks (already stored)
- ✅ URL parameter control
- ✅ Environment-aware UI

## 📋 Pre-Deployment Checklist

### 1. Verify Local Setup
- [x] Database schema applied to Supabase
- [x] 360 chunks embedded and stored
- [x] Both modes tested locally
- [x] Code committed to `rag` branch
- [x] `.env` file with all API keys

### 2. Environment Variables

Your production server needs these environment variables:

```bash
# AI API Keys
GEMINI_API_KEY=your_gemini_key
XAI_API_KEY=your_xai_key
OPENAI_API_KEY=your_openai_key  # NEW - Required for RAG embeddings

# Supabase Configuration
SUPABASE_URL=https://mlxctdgnojvkgfqldaob.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # For admin operations

# Server Configuration
PORT=3456  # Or your preferred port
```

**⚠️ IMPORTANT:** The `OPENAI_API_KEY` is **required** for RAG mode to work. Query embeddings are generated using OpenAI's API.

## 🚀 Deployment Steps

### Step 1: Merge to Main Branch

```bash
# Switch to main branch
git checkout main

# Merge RAG branch
git merge rag

# Push to main
git push origin main
```

### Step 2: Update Production Environment Variables

Add the new environment variable to your production server:

**For cPanel/shared hosting:**
1. Go to cPanel → Node.js App Manager
2. Edit your application
3. Add environment variable: `OPENAI_API_KEY=your_key_here`
4. Restart the application

**For VPS/Cloud (systemd):**
```bash
# Edit environment file
sudo nano /etc/systemd/system/chat-app.service

# Add to [Service] section:
Environment="OPENAI_API_KEY=your_openai_key"

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart chat-app
```

**For PM2:**
```bash
# Update ecosystem file
nano ecosystem.config.brightbean.js

# Add to env:
env: {
  OPENAI_API_KEY: "your_openai_key",
  // ... other vars
}

# Restart
pm2 restart manual-bot
```

### Step 3: Deploy Code

**Option A: Git Pull (Recommended)**
```bash
# SSH into your server
ssh user@your-server.com

# Navigate to app directory
cd /path/to/chat

# Pull latest code
git pull origin main

# Install dependencies (if any new ones)
npm install

# Restart application
pm2 restart manual-bot
# OR
sudo systemctl restart chat-app
```

**Option B: Upload via cPanel/FTP**
1. Build locally: `npm run build`
2. Upload `dist/` folder contents
3. Upload `server.js`, `package.json`, PDF files
4. Restart app via cPanel Node.js manager

### Step 4: Verify Deployment

Test these URLs on production:

1. **Full Doc mode (default):**
   ```
   https://brightbean.io
   ```

2. **RAG mode:**
   ```
   https://brightbean.io?method=rag
   ```

3. **UHN + RAG:**
   ```
   https://brightbean.io?doc=uhn&method=rag
   ```

4. **Health check:**
   ```
   https://brightbean.io/api/health
   ```

### Step 5: Verify Database Connection

Check that production can access Supabase:

```bash
# SSH into server
ssh user@your-server.com

# Test database connection
curl -X POST https://your-domain.com/chat/api/chat-rag \
  -H "Content-Type: application/json" \
  -d '{"message":"test","model":"gemini","doc":"smh"}'
```

Should return a response with chunks retrieved.

## 🔍 Post-Deployment Verification

### 1. Test Full Doc Mode
- [ ] Open: `https://brightbean.io`
- [ ] Toggle buttons should be **HIDDEN**
- [ ] Ask a question
- [ ] Verify response shows: `Response time: XXXms`
- [ ] Check browser console for no errors

### 2. Test RAG Mode
- [ ] Open: `https://brightbean.io?method=rag`
- [ ] Ask the same question
- [ ] Verify response shows: `Response time: XXXms` (no RAG details)
- [ ] Check server logs for: `RAG: Found X relevant chunks`
- [ ] Response should be faster than Full Doc

### 3. Test Document Switching
- [ ] Test: `?doc=smh` (default)
- [ ] Test: `?doc=uhn`
- [ ] Test: `?doc=uhn&method=rag`
- [ ] Verify correct manual is used

### 4. Monitor Server Logs
```bash
# For PM2
pm2 logs manual-bot

# For systemd
sudo journalctl -u chat-app -f

# Look for:
# - "RAG: Found X relevant chunks"
# - No OpenAI API errors
# - No Supabase connection errors
```

## 📊 Monitoring & Analytics

### Check Supabase Logs
1. Go to Supabase Dashboard
2. Navigate to Logs → Postgres Logs
3. Look for `match_document_chunks` function calls
4. Verify no errors

### Check Analytics
```bash
curl https://brightbean.io/api/analytics
```

Should show:
- `retrieval_method: "rag"` for RAG queries
- `retrieval_method: "full"` for Full Doc queries
- `chunks_used` and `retrieval_time_ms` for RAG queries

## 🔧 Troubleshooting

### Issue: "OPENAI_API_KEY not found"
**Solution:** Add environment variable to production server and restart.

### Issue: "Failed to generate embedding"
**Causes:**
1. Invalid OpenAI API key
2. OpenAI API rate limit exceeded
3. Network connectivity issues

**Solution:**
```bash
# Test API key
curl https://api.openai.com/v1/embeddings \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":"test","model":"text-embedding-3-small"}'
```

### Issue: "No chunks found" / "0 relevant chunks"
**Causes:**
1. Database not accessible from production
2. Embeddings not properly stored
3. Query embedding dimension mismatch

**Solution:**
```bash
# Check if chunks exist
curl https://mlxctdgnojvkgfqldaob.supabase.co/rest/v1/document_chunks?select=count \
  -H "apikey: YOUR_ANON_KEY"
```

Should return `count: 360`

### Issue: RAG mode not activating
**Solution:** Verify URL parameter is correctly parsed. Check browser console for logs.

### Issue: Toggle buttons showing in production
**Causes:** 
1. Domain not properly detected
2. localhost detection failing

**Solution:** Check that domain is NOT localhost/127.0.0.1. Frontend should log:
```
🌐 Production environment - retrieval controls hidden
```

## 💰 Cost Estimates

### Per Month (Estimated Usage)

**OpenAI Embeddings:**
- Cost: $0.00002 per 1K tokens
- Average query: ~100 tokens
- 1000 queries/month: ~$0.002 (negligible)

**Supabase:**
- Free tier: 500MB database, 2GB bandwidth
- Current usage: ~6MB (360 chunks + embeddings)
- Well within free tier limits

**Total Additional Cost:** ~$0.01-0.10/month

## 🔄 Rollback Plan

If RAG mode causes issues:

### Option 1: Disable RAG via Config
```javascript
// In server.js, comment out RAG endpoint
// app.post('/api/chat-rag', async (req, res) => { ... });

// Restart server
```

### Option 2: Revert to Previous Version
```bash
git checkout main
git revert HEAD
git push origin main
# Deploy previous version
```

### Option 3: Hide RAG in Production Only
```javascript
// In public/index.html
// Change URL detection to always hide in production
body:not(.local-env) .retrieval-selector {
  display: none !important;
}
```

Full Doc mode is **completely unchanged**, so your existing functionality is safe!

## 📝 Embed Instructions

### For WordPress/Joomla Pages

**Full Doc Mode (default):**
```html
<iframe 
  src="https://brightbean.io?doc=smh" 
  width="100%" 
  height="600px" 
  frameborder="0">
</iframe>
```

**RAG Mode:**
```html
<iframe 
  src="https://brightbean.io?doc=smh&method=rag" 
  width="100%" 
  height="600px" 
  frameborder="0">
</iframe>
```

**UHN Manual with RAG:**
```html
<iframe 
  src="https://brightbean.io?doc=uhn&method=rag" 
  width="100%" 
  height="600px" 
  frameborder="0">
</iframe>
```

## 🎓 Training Users

Since RAG is controlled via URL and hidden in production:

1. **Default behavior:** Users continue using Full Doc mode (unchanged)
2. **Test RAG mode:** Share specific links with `?method=rag` for testing
3. **Switch permanently:** Update embed URLs to include `?method=rag` when ready

## 📈 Success Metrics

Monitor these to evaluate RAG effectiveness:

1. **Response Times:**
   - Full Doc: ~3-5 seconds
   - RAG: ~2-4 seconds (should be faster)

2. **User Satisfaction:**
   - Compare answer quality between modes
   - Track which mode users prefer (via analytics)

3. **Cost Savings:**
   - Monitor OpenAI token usage
   - RAG should use ~12x fewer tokens per query

4. **Database Performance:**
   - Check Supabase query times
   - Vector search should be <1 second

## 🆘 Support

If you encounter issues during deployment:

1. Check server logs for error messages
2. Verify all environment variables are set
3. Test database connectivity to Supabase
4. Confirm OpenAI API key is valid
5. Review browser console for frontend errors

## ✅ Deployment Complete!

Once all steps are verified:
- [ ] Full Doc mode working
- [ ] RAG mode working
- [ ] Both documents (SMH/UHN) accessible
- [ ] URL parameters functioning
- [ ] Analytics tracking both modes
- [ ] No toggle buttons in production
- [ ] Performance metrics showing

Your RAG enhancement is now live! 🚀

