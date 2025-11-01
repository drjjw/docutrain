# Deployment Guide for Refactored RAG-Only App

**Last Updated:** October 19, 2025

This guide covers the deployment workflow for the refactored RAG-only chatbot with zero-downtime document updates, proper logo handling, and safe rsync practices.

---

## Table of Contents

1. [Quick Deploy](#quick-deploy)
2. [Initial Server Setup](#initial-server-setup)
3. [Deployment Process](#deployment-process)
4. [Document Updates (No Restart Required)](#document-updates-no-restart-required)
5. [Logo Updates](#logo-updates)
6. [PM2 Management](#pm2-management)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Quick Deploy

```bash
# 1. Build locally
node build.js

# 2. Deploy with safe rsync
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='*.log' \
  --exclude='server.pid' \
  -e "ssh -i ~/.ssh/drjjw.pub -p 7022" \
  dist/ root@162.246.254.111:/home/ukidney/brightbean.io/

# 3. Reload (zero downtime)
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111
cd /home/ukidney/brightbean.io
pm2 reload manual-bot
```

---

## Initial Server Setup

### First-Time Deployment

```bash
# 1. Build locally
node build.js

# 2. Upload files (initial deploy - no --delete yet)
rsync -avz \
  -e "ssh -i ~/.ssh/drjjw.pub -p 7022" \
  dist/ root@162.246.254.111:/home/ukidney/brightbean.io/

# 3. SSH into server
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111

# 4. Create .env file on server
cd /home/ukidney/brightbean.io
nano .env
```

**Paste this into .env:**

```env
GEMINI_API_KEY=your_key_here
XAI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
PORT=3456

# Supabase Configuration
SUPABASE_URL=https://mlxctdgnojvkgfqldaob.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# RAG Configuration
RAG_SIMILARITY_THRESHOLD=0.3
```

```bash
# 5. Install dependencies
npm install --production

# 6. Start with PM2
pm2 start ecosystem.config.brightbean.js --env production
pm2 save
pm2 startup  # Follow the instructions to enable PM2 on boot
```

---

## Deployment Process

### Standard Deployment (After Initial Setup)

```bash
# Step 1: Build locally
node build.js
```

**What this does:**
- Hashes CSS/JS files for cache busting (e.g., `styles.a877ed21.css`)
- Updates HTML references to hashed files
- Copies logos, server files, and configs to `dist/`
- Excludes PDFs (RAG-only mode uses database embeddings)

```bash
# Step 2: Sync to server (safe method)
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='*.log' \
  --exclude='server.pid' \
  -e "ssh -i ~/.ssh/drjjw.pub -p 7022" \
  dist/ root@162.246.254.111:/home/ukidney/brightbean.io/
```

**Why these exclusions:**
- `node_modules` - Platform-specific, huge, installed separately
- `.env` - Contains secrets, never in source control
- `*.log` - Preserves server logs
- `server.pid` - Preserves PM2 process tracking

```bash
# Step 3: Reload application (on server)
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111
cd /home/ukidney/brightbean.io

# Option A: Zero-downtime reload (recommended)
pm2 reload manual-bot

# Option B: Fast restart (brief 2-5s downtime)
pm2 restart manual-bot

# Option C: Only if package.json changed
npm install --production
pm2 reload manual-bot
```

---

## Document Updates (No Restart Required)

### 🎉 Zero-Downtime Document Updates

The app now features **auto-refresh** for documents without server restarts!

#### How It Works

1. **Auto-refresh every 2 minutes** - Server checks Supabase for new/updated documents
2. **Manual trigger** - Force immediate refresh via API endpoint
3. **Cache with TTL** - 5-minute cache reduces database load

#### Add/Update Documents

```bash
# 1. Add document to Supabase `documents` table
# - Use Supabase dashboard or SQL

# 2. Wait up to 2 minutes for auto-refresh
# OR trigger immediately:

curl -X POST https://brightbean.io/api/refresh-registry
```

**Response:**
```json
{
  "success": true,
  "message": "Document registry cache cleared and refreshed",
  "documentCount": 118
}
```

#### Benefits

✅ **No server restart** required for document updates  
✅ **No downtime** when adding/removing documents  
✅ **Instant updates** with manual trigger  
✅ **Scalable** for frequent document changes

---

## Logo Updates

### Multi-Tenant Logo System

The app supports per-owner logos (e.g., `ukidney`, `maker`).

#### Add New Logo

```bash
# 1. Add logo to public/logos/
cp new-logo.png public/logos/owner-logo.png

# 2. Update build.js to include it
# Edit build.js around line 217:
const logoFiles = [
    { from: 'public/logos/maker-logo-trns.png', to: 'public/logos/maker-logo-trns.png' },
    { from: 'public/logos/ukidney-logo.svg', to: 'public/logos/ukidney-logo.svg' },
    { from: 'public/logos/owner-logo.png', to: 'public/logos/owner-logo.png' }  // ADD THIS
];

# 3. Update public/js/config.js
# Add to ownerLogoConfig object:
'owner-name': {
    logo: 'logos/owner-logo.png',
    alt: 'Owner Name',
    link: 'https://example.com',
    accentColor: '#007acc'
}

# 4. Rebuild and deploy
node build.js
rsync -avz --delete --exclude='node_modules' --exclude='.env' \
  -e "ssh -i ~/.ssh/drjjw.pub -p 7022" \
  dist/ root@162.246.254.111:/home/ukidney/brightbean.io/
```

#### Logo CSS (Updated for Multi-Tenant)

The CSS now uses generic `.logo` class (not `.ukidney-logo`) with:
- Right-aligned positioning (close to separator)
- Larger dimensions: 48px height desktop, 36px mobile
- `justify-content: flex-end` for right alignment
- Support for various logo aspect ratios

---

## PM2 Management

### Common Commands

```bash
# Check status
pm2 status

# View logs (last 50 lines)
pm2 logs manual-bot --lines 50

# View only errors
pm2 logs manual-bot --err --lines 50

# Graceful reload (zero downtime)
pm2 reload manual-bot

# Fast restart (brief downtime)
pm2 restart manual-bot

# Stop application
pm2 stop manual-bot

# Start application
pm2 start ecosystem.config.brightbean.js --env production

# Delete from PM2 (full removal)
pm2 delete manual-bot

# Save current PM2 process list
pm2 save

# View detailed process info
pm2 describe manual-bot

# Monitor in real-time
pm2 monit
```

### Graceful Reload vs Restart

**Reload (Recommended):**
- Zero downtime
- Starts new instance, waits for ready signal
- Keeps old instance running until new one ready
- Takes ~10-15 seconds (loads document registry)

**Restart (Faster):**
- Brief 2-5 second downtime
- Immediately kills and restarts
- Faster but drops active requests

### Ecosystem Configuration

`ecosystem.config.brightbean.js` settings:
```javascript
{
  kill_timeout: 5000,      // Wait 5s for graceful shutdown
  wait_ready: true,        // Wait for ready signal
  listen_timeout: 15000,   // Wait 15s for app to start (RAG-only)
  restart_delay: 6000,     // Delay between restarts
  max_restarts: 3,         // Max restarts before giving up
  min_uptime: '10s'        // Min uptime to consider successful
}
```

---

## Troubleshooting

### Server Returns 503 Error

**Symptoms:** "Service Unavailable" for extended period

**Check PM2 status:**
```bash
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111
pm2 status
```

Look for:
- **Status: stopped** → App crashed, check logs
- **Restart count (↺) high** → App in crash loop
- **Memory: 0b** → App not starting

**Check logs:**
```bash
pm2 logs manual-bot --err --lines 50
```

### Common Errors

#### 1. `Cannot find module 'express'`

**Cause:** Missing `node_modules`

**Fix:**
```bash
cd /home/ukidney/brightbean.io
npm install --production
pm2 restart manual-bot
```

#### 2. Supabase Connection Failed

**Cause:** Missing or incorrect `.env` file

**Fix:**
```bash
cd /home/ukidney/brightbean.io
cat .env  # Verify exists and has correct values
nano .env  # Edit if needed
pm2 restart manual-bot
```

#### 3. App Starts Then Crashes

**Cause:** Document registry failed to load

**Check logs:**
```bash
pm2 logs manual-bot --lines 100
```

Look for:
- Database connection errors
- Supabase credential issues
- Network timeouts

**Fix:**
```bash
# Test Supabase connection
curl -H "apikey: YOUR_ANON_KEY" https://mlxctdgnojvkgfqldaob.supabase.co/rest/v1/documents
```

#### 4. Old CSS/JS Still Loading

**Cause:** Browser cache or CDN cache

**Fix:**
```bash
# 1. Verify new files deployed
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111
cd /home/ukidney/brightbean.io/public/css
ls -lh styles.*  # Should see new hash

# 2. Clear browser cache (Cmd+Shift+R or Ctrl+Shift+R)

# 3. Check index.html references correct hash
cat public/index.html | grep styles
```

### Health Checks

```bash
# Server health
curl https://brightbean.io/api/health

# Document registry status
curl https://brightbean.io/api/documents

# Force registry refresh
curl -X POST https://brightbean.io/api/refresh-registry
```

---

## Best Practices

### 1. **Always Exclude Critical Files from rsync --delete**

```bash
--exclude='node_modules'  # Never sync these
--exclude='.env'          # Protect secrets
--exclude='*.log'         # Keep logs
--exclude='server.pid'    # PM2 tracking
```

### 2. **Use Graceful Reloads for Production**

```bash
pm2 reload manual-bot  # Zero downtime
```

Only use `restart` when:
- Debugging crashes
- Updating ecosystem.config.brightbean.js
- Major Node.js version changes

### 3. **Test Builds Locally First**

```bash
# Always test before deploying
node build.js
cd dist
node server.js  # Test locally on port 3456
```

### 4. **Monitor Deploys**

```bash
# After deployment, watch logs for issues
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111
pm2 logs manual-bot --lines 100
```

### 5. **Document Registry Updates**

For frequent document updates:
- Add documents via Supabase dashboard/API
- Wait 2 minutes for auto-refresh OR
- Trigger manual refresh: `curl -X POST .../api/refresh-registry`
- **No server restart needed!**

### 6. **Keep .env Secure**

Never commit `.env` to git:
```bash
# Verify .gitignore includes
cat .gitignore | grep .env
```

Always maintain separate `.env` file on server.

### 7. **Cache Busting Works Automatically**

The build process hashes files:
- `styles.css` → `styles.a877ed21.css`
- Hash changes when content changes
- Browsers automatically fetch new versions
- No manual cache clearing needed (for end users)

### 8. **Backup Before Major Deploys**

```bash
# Backup current production code
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111
cd /home/ukidney
tar -czf brightbean.io.backup.$(date +%Y%m%d).tar.gz brightbean.io/
```

---

## Summary of Key Improvements

### ✅ Zero-Downtime Document Updates
- Auto-refresh every 2 minutes
- Manual trigger via API
- No server restart needed

### ✅ Safe Deployment with rsync
- `--delete` with proper exclusions
- Preserves `node_modules` and `.env`
- Automatic cache busting with hashed files

### ✅ Multi-Tenant Logo Support
- Generic `.logo` CSS class
- Right-aligned, larger dimensions
- Easy to add new owner logos

### ✅ Optimized PM2 Configuration
- Faster graceful reloads (15s vs 30s)
- Better health checks
- Automatic restarts on failures

### ✅ RAG-Only Architecture
- No PDFs in production (~500MB saved)
- Database-stored embeddings
- Faster deployment and startup

---

## Quick Reference Commands

```bash
# Full deployment
node build.js && \
rsync -avz --delete --exclude='node_modules' --exclude='.env' \
  -e "ssh -i ~/.ssh/drjjw.pub -p 7022" \
  dist/ root@162.246.254.111:/home/ukidney/brightbean.io/ && \
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 \
  "cd /home/ukidney/brightbean.io && pm2 reload manual-bot"

# Quick sync (no build)
rsync -avz --exclude='node_modules' --exclude='.env' \
  -e "ssh -i ~/.ssh/drjjw.pub -p 7022" \
  dist/ root@162.246.254.111:/home/ukidney/brightbean.io/

# Update documents (no deploy)
curl -X POST https://brightbean.io/api/refresh-registry

# Check health
curl https://brightbean.io/api/health
```

---

## Support & Documentation

- **Main Documentation:** `docs/DEPLOYMENT.md`
- **API Reference:** `docs/API_REFERENCE.md`
- **Troubleshooting:** `docs/TROUBLESHOOTING.md`
- **RAG Setup:** `docs/RAG-SETUP.md`

---

*Last tested: October 19, 2025*  
*Server: brightbean.io (162.246.254.111:7022)*  
*PM2 App Name: manual-bot*

