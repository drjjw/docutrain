# Quick Fix Commands for 503 Error

## Step 1: SSH into the server
```bash
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111
```

## Step 2: Run the troubleshooting script
```bash
cd /home/docutrainio/public_html
bash /path/to/troubleshoot-503.sh
```

## Step 3: Common Fixes

### Fix 1: Process crashed - restart it
```bash
cd /home/docutrainio/public_html
pm2 delete docutrainio-bot
pm2 start server.js --name docutrainio-bot
pm2 save
pm2 logs docutrainio-bot --lines 50
```

### Fix 2: Missing dependencies
```bash
cd /home/docutrainio/public_html
npm install --production --legacy-peer-deps
pm2 restart docutrainio-bot
```

### Fix 3: Missing .env file
```bash
cd /home/docutrainio/public_html
# Check if .env exists
ls -la .env
# If missing, you'll need to recreate it with your environment variables
```

### Fix 4: Use PM2 ecosystem config (recommended)
```bash
cd /home/docutrainio/public_html
pm2 delete docutrainio-bot
pm2 start docutrainio-bot.js --env production
pm2 save
pm2 logs docutrainio-bot --lines 50
```

### Fix 5: Check for syntax errors
```bash
cd /home/docutrainio/public_html
node -c server.js
# If errors, check the output and fix the code
```

### Fix 6: Check logs for specific errors
```bash
pm2 logs docutrainio-bot --err --lines 100
# Look for:
# - "Cannot find module" → missing dependencies
# - "EADDRINUSE" → port already in use
# - "ECONNREFUSED" → database connection issue
# - Syntax errors → code issue
```

## Step 4: Verify server is running
```bash
# Check PM2 status
pm2 status

# Check if server responds
curl http://localhost:3458/api/health

# Check port
netstat -tuln | grep 3458
```

## Step 5: Monitor in real-time
```bash
pm2 monit
# Or watch logs
pm2 logs docutrainio-bot
```

