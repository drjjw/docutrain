# DocuTrain.io Deployment Guide

Complete deployment guide for the DocuTrain.io production environment, including troubleshooting based on real-world deployment issues.

## Table of Contents
1. [Production Environment](#production-environment)
2. [Deployment Process](#deployment-process)
3. [Troubleshooting](#troubleshooting)
4. [Common Issues](#common-issues)
5. [Verification Steps](#verification-steps)

---

## Production Environment

### Server Details
- **Domain**: docutrain.io (www.docutrain.io)
- **Server IP**: 162.246.254.111
- **SSH Port**: 7022
- **SSH Key**: `~/.ssh/drjjw.pub`
- **Server Path**: `/home/docutrainio/public_html`
- **Application Port**: 3458
- **Process Manager**: PM2
- **Process Name**: `docutrainio-bot`

### Environment Configuration
The `.env` file on the server must contain:
```bash
GEMINI_API_KEY=...
XAI_API_KEY=...
OPENAI_API_KEY=...
PORT=3458

# Supabase Configuration
SUPABASE_URL=https://mlxctdgnojvkgfqldaob.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# RAG Configuration
RAG_SIMILARITY_THRESHOLD=0.3
```

**IMPORTANT**: The `.env` file is excluded from deployment and must be manually copied to the server.

---

## Deployment Process

### Quick Deployment
Use the primary deployment script:
```bash
./deploy.sh
```

Or the alternative:
```bash
./deploy3.sh
```

### What Happens During Deployment

1. **Build Phase**
   - React app is built: `npm run build:app`
   - Server files are processed: `node build.js`
   - Files are hashed for cache busting
   - Output is placed in `/dist/`

2. **Transfer Phase**
   - Files are synced via rsync to `/home/docutrainio/public_html`
   - Excludes: `node_modules`, `.env`
   - Preserves: existing `.env` on server

3. **Restart Phase**
   - Stops existing PM2 process: `pm2 stop docutrainio-bot`
   - Deletes PM2 process: `pm2 delete docutrainio-bot`
   - Starts server directly: `pm2 start server.js --name docutrainio-bot`
   - Saves PM2 configuration: `pm2 save`
   - Waits 5 seconds for startup
   - Verifies server is responding on port 3458

### Manual Deployment Steps

If you need to deploy manually:

```bash
# 1. Build locally
npm run build

# 2. Transfer files
rsync -avz --delete --exclude='node_modules' --exclude='.env' \
  -e "ssh -i ~/.ssh/drjjw.pub -p 7022" \
  dist/ root@162.246.254.111:/home/docutrainio/public_html

# 3. SSH to server
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111

# 4. Navigate to directory
cd /home/docutrainio/public_html

# 5. Fix permissions
chown -R docutrainio:docutrainio /home/docutrainio/public_html

# 6. Restart PM2
pm2 stop docutrainio-bot
pm2 delete docutrainio-bot
pm2 start server.js --name docutrainio-bot
pm2 save

# 7. Verify
pm2 list
netstat -tlnp | grep 3458
curl -I http://localhost:3458/
```

---

## Troubleshooting

### Issue 1: Server Shows "Service Unavailable"

**Symptoms:**
- PM2 shows process as "online"
- `netstat -tlnp | grep 3458` returns nothing
- `curl http://localhost:3458` fails with "Connection refused"

**Diagnosis:**
```bash
# Check PM2 status
pm2 list

# Check if port is listening
netstat -tlnp | grep 3458

# Check logs for errors
pm2 logs docutrainio-bot --lines 100

# Look for SIGINT in logs (indicates premature shutdown)
pm2 logs docutrainio-bot | grep SIGINT
```

**Common Causes:**

1. **PM2 Config File Issue** (Most Common)
   - The `docutrainio-bot.js` config file has `wait_ready: true`
   - Server doesn't send ready signal in time
   - PM2 kills the process after 15 seconds

   **Solution:**
   ```bash
   # Start directly with server.js instead of config file
   pm2 stop docutrainio-bot
   pm2 delete docutrainio-bot
   pm2 start server.js --name docutrainio-bot
   pm2 save
   ```

2. **Missing or Incomplete .env File**
   - Server can't read PORT=3458
   - Server defaults to port 3456 or fails to start

   **Solution:**
   ```bash
   # Verify .env exists and is complete
   cat .env
   
   # If missing, copy from local machine
   scp -i ~/.ssh/drjjw.pub -P 7022 .env root@162.246.254.111:/home/docutrainio/public_html/.env
   
   # Then restart
   pm2 restart docutrainio-bot
   ```

3. **Server Process Dying Immediately**
   - Check logs for startup errors
   - Look for missing dependencies

   **Solution:**
   ```bash
   # Check logs
   pm2 logs docutrainio-bot --lines 50
   
   # Install dependencies if needed
   cd /home/docutrainio/public_html
   npm install --production
   ```

### Issue 2: Port 3458 Not Listening

**Verification:**
```bash
# Check what ports Node is listening on
netstat -tlnp | grep node

# Check if process is running
ps aux | grep docutrainio

# Check PM2 process details
pm2 info docutrainio-bot
```

**Solution:**
```bash
# 1. Verify .env has PORT=3458
grep PORT .env

# 2. Restart with explicit port
pm2 stop docutrainio-bot
pm2 delete docutrainio-bot
pm2 start server.js --name docutrainio-bot
pm2 save

# 3. Wait and verify
sleep 5
netstat -tlnp | grep 3458
```

### Issue 3: PM2 Process Keeps Restarting

**Symptoms:**
- `pm2 list` shows high restart count (↺ column)
- Server is unstable

**Diagnosis:**
```bash
# Check restart count
pm2 list

# Check logs for crash reasons
pm2 logs docutrainio-bot --lines 100

# Check error logs specifically
tail -100 /root/.pm2/logs/docutrainio-bot-error.log
```

**Common Causes:**
1. Missing dependencies
2. Database connection issues
3. Memory issues
4. Port conflicts

**Solution:**
```bash
# Check for errors in logs
pm2 logs docutrainio-bot

# If database issues, verify Supabase credentials in .env
cat .env | grep SUPABASE

# If memory issues, check server resources
free -h
pm2 info docutrainio-bot
```

### Issue 4: Changes Not Appearing After Deployment

**Possible Causes:**
1. Browser cache
2. CDN cache
3. Files didn't upload
4. Server not restarted

**Solution:**
```bash
# 1. Verify files were uploaded
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 \
  "ls -la /home/docutrainio/public_html/server.js"

# 2. Check file modification time
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 \
  "stat /home/docutrainio/public_html/server.js"

# 3. Force restart
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 \
  "cd /home/docutrainio/public_html && pm2 restart docutrainio-bot"

# 4. Clear browser cache (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
```

---

## Common Issues

### "wait_ready" Timeout Issue

**Background:**
The `docutrainio-bot.js` PM2 config file originally had `wait_ready: true`, which expects the Node.js app to send a `process.send('ready')` signal. If the server doesn't send this signal within 15 seconds, PM2 sends SIGINT and kills the process.

**Why It Happens:**
- Server loads 127 documents during startup
- This can take longer than 15 seconds
- PM2 times out and kills the process
- Server appears "online" but isn't actually listening

**Permanent Fix:**
The deployment scripts now start the server directly with `server.js` instead of using the PM2 config file:
```bash
pm2 start server.js --name docutrainio-bot
```

This bypasses the `wait_ready` configuration entirely.

### .htaccess Configuration

The `.htaccess` file proxies all requests to Node.js on port 3458:

```apache
# Proxy everything to Node.js on port 3458
RewriteRule ^(.*)$ http://127.0.0.1:3458/$1 [P,L,QSA]
```

**Important:** If the Node.js server isn't listening on port 3458, Apache will show "Service Unavailable" even though PM2 shows the process as "online".

### BrightBean.io Migration

**Historical Context:**
The application was previously deployed to brightbean.io and has been migrated to docutrain.io. All references to brightbean.io have been removed from:
- Deployment scripts (`deploy.sh`, `deploy3.sh`)
- Build configuration (`build.js`)
- PM2 configs (removed `ecosystem.config.brightbean.js`)
- Frontend config (`public/js/config.js`)

If you see any brightbean.io references, they should be removed.

---

## Verification Steps

### After Every Deployment

Run these checks to ensure successful deployment:

```bash
# 1. SSH to server
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111

# 2. Check PM2 status
pm2 list
# Should show: docutrainio-bot | online | 0% CPU | ~60MB memory

# 3. Verify port is listening
netstat -tlnp | grep 3458
# Should show: tcp6 ... :::3458 ... LISTEN ... node

# 4. Test local response
curl -I http://localhost:3458/
# Should return: HTTP/1.1 200 OK

# 5. Test external response
curl -I https://www.docutrain.io/
# Should return: HTTP/2 200

# 6. Check logs for errors
pm2 logs docutrainio-bot --lines 20
# Should show: "Server running at http://localhost:3458"
# Should NOT show: "SIGINT received" or errors
```

### Health Check Endpoints

The application provides health check endpoints:

```bash
# Basic health check
curl http://localhost:3458/api/ready

# Document registry status
curl http://localhost:3458/api/documents
```

---

## Emergency Procedures

### Complete Server Restart

If everything is broken:

```bash
# 1. SSH to server
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111

# 2. Navigate to directory
cd /home/docutrainio/public_html

# 3. Stop all PM2 processes
pm2 stop all
pm2 delete all

# 4. Verify .env file exists and is complete
cat .env

# 5. Start fresh
pm2 start server.js --name docutrainio-bot
pm2 save

# 6. Verify
sleep 5
pm2 list
netstat -tlnp | grep 3458
curl -I http://localhost:3458/
```

### Rollback to Previous Version

If a deployment breaks the site:

```bash
# 1. Check git history locally
git log --oneline -10

# 2. Checkout previous version
git checkout <previous-commit-hash>

# 3. Redeploy
./deploy.sh

# 4. Return to main branch
git checkout main
```

---

## Best Practices

1. **Always test locally before deploying**
   ```bash
   npm run build
   cd dist
   node server.js
   # Test at http://localhost:3458
   ```

2. **Monitor logs during deployment**
   ```bash
   # In a separate terminal during deployment
   ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 \
     "pm2 logs docutrainio-bot"
   ```

3. **Keep .env file backed up**
   - Never commit `.env` to git
   - Keep a secure backup copy locally
   - Document any changes to environment variables

4. **Use deploy.sh for consistency**
   - Don't manually copy files
   - Let the script handle the entire process
   - Reduces human error

5. **Verify after every deployment**
   - Check PM2 status
   - Verify port 3458 is listening
   - Test the live site
   - Check logs for errors

---

## Quick Reference

### Essential Commands

```bash
# Deploy
./deploy.sh

# Check status
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 "pm2 list"

# View logs
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 "pm2 logs docutrainio-bot --lines 50"

# Restart
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 "pm2 restart docutrainio-bot"

# Emergency restart
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 \
  "cd /home/docutrainio/public_html && pm2 delete docutrainio-bot && pm2 start server.js --name docutrainio-bot && pm2 save"
```

### File Locations

| Item | Location |
|------|----------|
| Local source | `/Users/jordanweinstein/GitHub/docutrain/` |
| Local build output | `/Users/jordanweinstein/GitHub/docutrain/dist/` |
| Server files | `/home/docutrainio/public_html/` |
| PM2 logs | `/root/.pm2/logs/docutrainio-bot-*.log` |
| Environment file | `/home/docutrainio/public_html/.env` |
| Apache config | `/home/docutrainio/public_html/.htaccess` |

---

## Support

If you encounter issues not covered in this guide:

1. Check PM2 logs: `pm2 logs docutrainio-bot --lines 100`
2. Check server logs: `tail -100 /root/.pm2/logs/docutrainio-bot-error.log`
3. Verify .env file is complete
4. Ensure port 3458 is not blocked by firewall
5. Check Apache error logs: `tail -100 /home/docutrainio/error_log`

---

**Last Updated:** October 28, 2025  
**Deployment Method:** PM2 with direct server.js execution  
**Production Domain:** https://www.docutrain.io  
**Port:** 3458

