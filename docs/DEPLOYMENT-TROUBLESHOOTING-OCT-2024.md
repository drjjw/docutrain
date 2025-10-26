# Deployment Troubleshooting - October 26, 2025

## The Problem

Document titles on https://brightbean.io/app/dashboard were showing with `truncate` CSS class, cutting off long titles. Despite multiple deployments and cache purges, the old styling persisted.

## Root Causes Discovered

### 1. Missing `.env` File on Server
**The Critical Issue:** The production server was missing the `.env` file entirely.

- **Symptom:** Server appeared "online" in PM2 but wasn't actually listening on port 3456
- **Why:** Node.js crashed immediately on startup with `OpenAIError: The OPENAI_API_KEY environment variable is missing`
- **Result:** Apache/Cloudflare served cached old files because no live server was responding

### 2. PM2 Ecosystem Config Bug
**Issue:** PM2 was executing `ecosystem.config.brightbean.js` as a script instead of reading it as a configuration file.

- **Symptom:** Process showed as `ecosystem.config...` instead of `brightbean-bot`
- **Why:** When using `pm2 start ecosystem.config.brightbean.js`, PM2 sometimes treats the config file as the script to run
- **Result:** Server never actually started

### 3. Deploy Script Issues
**Multiple problems with `deploy.sh`:**

- Excluded `.env` from deployment (line: `--exclude='.env'`)
- Used wrong PM2 startup command (ecosystem config instead of direct script)
- SSH key confusion (`bbsltn_key` vs `drjjw.pub`)

### 4. Aggressive Caching
**Cloudflare and Apache were caching everything:**

- Even after uploading new files, cached versions persisted
- Could still view site even when server was completely dead (nothing on port 3456)
- `Last-Modified` headers showed old dates (Oct 25) even on Oct 26

## What Was Actually Wrong

The document titles were CORRECT in the source code - they never had `truncate` class. But:

1. Server crashed due to missing `.env`
2. PM2 showed "online" but server wasn't listening
3. Cloudflare/Apache served stale cached files from before the fix
4. Browser showed old bundle (`main-D48_T3Va.js`) instead of new one (`main-MVgw_J_6.js`)

## The Solution

### Step 1: Create `start.sh` Wrapper Script
Created a startup script that properly loads `.env` before starting Node:

```bash
#!/bin/bash
cd /home/brightbeanio/public_html
export $(cat .env | grep -v '^#' | xargs)
node server.js
```

**Why:** PM2 can't reliably load `.env` files, so we do it manually.

### Step 2: Update `build.js`
Added automatic creation of `start.sh` during build process:

```javascript
// Create start.sh in dist
const startShContent = `#!/bin/bash
cd /home/brightbeanio/public_html
export $(cat .env | grep -v '^#' | xargs)
node server.js
`;
fs.writeFileSync(path.join(distDir, 'start.sh'), startShContent);
fs.chmodSync(path.join(distDir, 'start.sh'), '755');
console.log('✓ Created start.sh');
```

**Why:** Ensures `start.sh` is always included in deployments and won't be deleted by `rsync --delete`.

### Step 3: Fix `deploy.sh`
Changed PM2 startup command:

**Before:**
```bash
pm2 start ecosystem.config.brightbean.js --env production
```

**After:**
```bash
pm2 start start.sh --name brightbean-bot && pm2 save
```

**Why:** Avoids PM2's ecosystem config bug and ensures proper `.env` loading.

### Step 4: Manual `.env` Upload
The `.env` file must be manually uploaded via FTP to the production server:

```
Local:  /Users/jordanweinstein/GitHub/chat/.env
Server: /home/brightbeanio/public_html/.env
```

**Why:** `.env` is excluded from deployment for security (contains API keys) and should never be in git.

## SSH Access Issues

### The Confusion
Multiple SSH key files existed:
- `~/.ssh/drjjw.pub` - Public key (484 bytes)
- `~/.ssh/drjjw.pub.pub` - Duplicate public key
- `~/.ssh/bbsltn_key` - Different private key (1855 bytes, invalid format error)

### The Reality
- User deploys by running `./deploy.sh` and **manually entering password** when prompted
- The SSH key (`drjjw.pub`) is used for authentication negotiation, but password is still required
- Automated/passwordless SSH doesn't work with current setup
- This is fine - manual password entry is secure and works

### Correct SSH Command
```bash
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111
```
(Will prompt for password - this is expected)

## File Structure

### Local Development
```
/Users/jordanweinstein/GitHub/chat/
├── .env                    # Root .env for Node.js server (NOT in git)
├── app-src/
│   └── .env               # Vite .env for React build (NOT in git)
├── dist/                  # Build output
│   ├── app/               # React app (built from app-src)
│   ├── public/            # Main chat app
│   ├── server.js          # Server file
│   ├── start.sh           # PM2 startup wrapper (auto-generated)
│   └── NO .env HERE!      # .env is NOT copied to dist/
```

### Production Server
```
/home/brightbeanio/public_html/
├── .env                    # Manually uploaded via FTP
├── start.sh                # Deployed from dist/
├── app/                    # React app (from dist/app)
├── public/                 # Main chat app (from dist/public)
├── server.js               # Server file (from dist/server.js)
└── node_modules/           # npm install on server
```

## Deployment Process (Correct)

### 1. Build Locally
```bash
npm run build
```
This:
- Builds React app (`app-src` → `dist/app`)
- Builds main chat app (`public` → `dist/public`)
- Patches server.js paths for production
- Creates `start.sh` automatically

### 2. Deploy
```bash
./deploy.sh
```
(Enter password when prompted)

This:
- Uploads all files from `dist/` to server (except `.env`)
- Fixes file ownership
- Restarts PM2 with `start.sh`

### 3. Manual Steps (One-Time or When Env Changes)
- Upload `.env` via FTP if not already on server or if changed
- Purge Cloudflare cache if needed (Development Mode or Purge Everything)

## Verification Commands

### On Server
```bash
# Check if .env exists
ls -la /home/brightbeanio/public_html/.env

# Check PM2 status
pm2 list
# Should show: brightbean-bot (not ecosystem.config...)

# Check if server is listening
netstat -tlnp | grep 3456
# Should show: node listening on port 3456

# Test locally
curl -s http://127.0.0.1:3456/app/ | grep -o 'main-[^"]*\.js'
# Should show: main-MVgw_J_6.js (or current bundle hash)

# Check logs
pm2 logs brightbean-bot --lines 20
```

### From Local Machine
```bash
# Check what's being served publicly
curl -s https://brightbean.io/app/ | grep -o 'main-[^"]*\.js'
# Should match server's local response

# Check if server is responding
curl -I https://brightbean.io/app/
# Should show 200 OK with recent Last-Modified date
```

## Common Issues & Solutions

### Issue: "Server shows online but not responding"
**Diagnosis:**
```bash
netstat -tlnp | grep 3456  # Nothing listening
pm2 logs 0 --err           # Check for errors
```

**Solution:** Missing `.env` file or PM2 started wrong
```bash
# Upload .env via FTP
# Then restart:
pm2 delete brightbean-bot
pm2 start /home/brightbeanio/public_html/start.sh --name brightbean-bot
pm2 save
```

### Issue: "Old files still showing after deploy"
**Diagnosis:**
```bash
# Check what server has
cat /home/brightbeanio/public_html/app/index.html | grep main-

# Check what's being served
curl -s http://127.0.0.1:3456/app/ | grep main-
curl -s https://brightbean.io/app/ | grep main-
```

**Solution:** 
1. If server has new file but curl shows old: **Cloudflare cache** - Purge it
2. If server has old file: **Deploy didn't work** - Re-run deploy
3. If browser shows old: **Browser cache** - Hard refresh (Cmd+Shift+R)

### Issue: "PM2 shows ecosystem.config... instead of brightbean-bot"
**Problem:** PM2 is running the config file as a script

**Solution:**
```bash
pm2 delete all
pm2 start /home/brightbeanio/public_html/start.sh --name brightbean-bot
pm2 save
```

### Issue: "OpenAI API Key error in logs"
**Problem:** `.env` file missing or not loaded

**Solution:**
1. Upload `.env` via FTP
2. Restart with `start.sh` (not ecosystem config)

## Key Learnings

1. **PM2 "online" doesn't mean the server is working** - Always verify with `netstat` and `curl`
2. **Cloudflare caches aggressively** - Can serve files even when server is dead
3. **`.env` must be manually managed** - Never in git, never in build output, must upload separately
4. **PM2 ecosystem configs are unreliable** - Use wrapper scripts for environment loading
5. **Multiple caching layers exist** - Cloudflare, Apache, Express, Browser - all can cache independently

## Files Modified

### `/build.js`
- Added automatic `start.sh` creation (lines 271-279)

### `/deploy.sh`
- Changed PM2 command from ecosystem config to `start.sh`
- Kept SSH key as `drjjw.pub` (requires manual password entry)

### `/app-src/index.html`
- Removed `truncate` class from document titles (was never the issue, but confirmed correct)

## Success Criteria

✅ Server starts successfully with PM2
✅ Port 3456 is listening
✅ Correct bundle (`main-MVgw_J_6.js`) is served
✅ Document titles display without truncation
✅ Deploy script works end-to-end
✅ No OpenAI API key errors in logs

---

**Date:** October 26, 2025  
**Model Used:** Claude Sonnet 4.5  
**Time to Resolution:** ~3 hours  
**Root Cause:** Missing `.env` file causing server crash, masked by aggressive caching

