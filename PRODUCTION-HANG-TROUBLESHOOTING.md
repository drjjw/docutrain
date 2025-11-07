# Production Server Hang Troubleshooting Guide

## Quick Diagnosis Commands

### 1. Check PM2 Process Status
```bash
# Check if process is running and its status
pm2 status
pm2 info docutrainio-bot

# Check recent logs (last 100 lines)
pm2 logs docutrainio-bot --lines 100 --nostream

# Check for errors specifically
pm2 logs docutrainio-bot --err --lines 50 --nostream
```

### 2. Check if Server is Actually Listening
```bash
# Check if port 3458 is in use and by what process
netstat -tulpn | grep 3458
# OR on some systems:
ss -tulpn | grep 3458
# OR:
lsof -i :3458

# Check if process is listening but not responding
curl -v http://localhost:3458
curl -v http://localhost:3458/api/health
```

### 3. Test Server Startup Directly (Bypass PM2)
```bash
cd /home/docutrainio/public_html

# Check if we're in the right directory
pwd
ls -la server.js

# Try running server directly to see immediate errors
NODE_ENV=production node server.js

# If it hangs, press Ctrl+C after 30 seconds and check what it printed
```

### 4. Check Critical Files Exist
```bash
cd /home/docutrainio/public_html

# Check if dist directory and app exist
ls -la dist/
ls -la dist/app/
ls -la dist/app/index.html

# Check if required directories exist
ls -la lib/
ls -la public/

# Check if node_modules exists (critical!)
ls -la node_modules/ | head -5
```

### 5. Check Environment Variables
```bash
cd /home/docutrainio/public_html

# Verify .env file exists and has content
ls -la .env
cat .env | grep -E "PORT|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" | head -5

# Test if environment variables load correctly
node -e "require('dotenv').config(); console.log('PORT:', process.env.PORT); console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'MISSING'); console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');"
```

### 6. Test Document Registry Loading (Most Likely Culprit)
```bash
cd /home/docutrainio/public_html

# Test if document registry can load (this might hang if it's the problem)
timeout 30 node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('Testing Supabase connection...');
supabase.from('documents').select('slug').eq('active', true).limit(1).then(({data, error}) => {
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  console.log('Success! Found', data?.length || 0, 'documents');
  process.exit(0);
}).catch(err => {
  console.error('Exception:', err);
  process.exit(1);
});
"
```

### 7. Check for Syntax Errors
```bash
cd /home/docutrainio/public_html

# Check server.js syntax
node -c server.js

# Check if all required modules can be loaded
node -e "
try {
  require('./lib/document-registry');
  require('./lib/middleware');
  require('./lib/routes/chat');
  console.log('✓ All modules load successfully');
} catch (e) {
  console.error('✗ Module load error:', e.message);
  process.exit(1);
}
"
```

### 8. Check System Resources
```bash
# Check memory usage
free -h

# Check disk space
df -h

# Check if process is consuming resources
top -p $(pgrep -f "node.*server.js" | head -1)
```

### 9. Check Network Connectivity
```bash
# Test Supabase connectivity (user said this works, but verify)
curl -I https://mlxctdgnojvkgfqldaob.supabase.co

# Test with timeout
timeout 10 curl -v https://mlxctdgnojvkgfqldaob.supabase.co/rest/v1/ -H "apikey: $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)"
```

### 10. Check PM2 Configuration
```bash
# View PM2 ecosystem config if it exists
cat ecosystem.config.js 2>/dev/null || echo "No ecosystem.config.js found"

# Check PM2 logs location
pm2 describe docutrainio-bot | grep -E "log path|error path"
```

## Most Common Issues & Solutions

### Issue 1: Document Registry Loading Hangs
**Symptoms:** Server starts but hangs at "Phase 1: Loading document registry..."
**Solution:**
```bash
# Add timeout to document registry load
# Edit lib/document-registry.js and add timeout wrapper
# OR temporarily bypass registry loading for testing
```

### Issue 2: Missing dist/app/index.html
**Symptoms:** Server starts but requests hang
**Solution:**
```bash
cd /home/docutrainio/public_html
# Rebuild the app
npm run build
# Verify it exists
ls -la dist/app/index.html
```

### Issue 3: Port Already in Use
**Symptoms:** "EADDRINUSE" error or port shows as in use
**Solution:**
```bash
# Find what's using the port
lsof -i :3458
# Kill the process or change PORT in .env
```

### Issue 4: Missing node_modules in dist/
**Symptoms:** Module not found errors
**Solution:**
```bash
cd /home/docutrainio/public_html/dist
# If running from dist, need node_modules there too
npm install --production
```

### Issue 5: Environment Variables Not Loading
**Symptoms:** Server starts but can't connect to Supabase
**Solution:**
```bash
# Verify .env is in the right location
cd /home/docutrainio/public_html
pwd
ls -la .env
# Check if dotenv is finding it
node -e "require('dotenv').config(); console.log(process.env.SUPABASE_URL);"
```

## Step-by-Step Debugging Process

1. **First, check PM2 logs** - This will show where it's hanging
   ```bash
   pm2 logs docutrainio-bot --lines 200 --nostream
   ```

2. **If logs show it's stuck at "Phase 1"**, test document registry directly:
   ```bash
   cd /home/docutrainio/public_html
   timeout 30 node -e "require('./lib/document-registry').loadDocuments().then(() => console.log('OK')).catch(e => console.error(e))"
   ```

3. **If document registry works**, test full server startup:
   ```bash
   cd /home/docutrainio/public_html
   timeout 60 node server.js
   ```

4. **If server starts but requests hang**, check:
   - Is dist/app/index.html present?
   - Are static files being served?
   - Check network/firewall rules

5. **If nothing works**, restart PM2 and check again:
   ```bash
   pm2 restart docutrainio-bot
   pm2 logs docutrainio-bot --lines 50
   ```

## Quick Fix Attempts

### Attempt 1: Restart PM2 Process
```bash
pm2 restart docutrainio-bot
pm2 logs docutrainio-bot --lines 50
```

### Attempt 2: Rebuild and Restart
```bash
cd /home/docutrainio/public_html
npm run build
pm2 restart docutrainio-bot
```

### Attempt 3: Clear PM2 and Start Fresh
```bash
pm2 delete docutrainio-bot
cd /home/docutrainio/public_html
pm2 start server.js --name docutrainio-bot
pm2 logs docutrainio-bot
```

## What to Report Back

When reporting the issue, include:
1. Output of `pm2 logs docutrainio-bot --lines 100 --nostream`
2. Output of `pm2 info docutrainio-bot`
3. Output of `ls -la dist/app/` (verify index.html exists)
4. Output of the document registry test (command #6 above)
5. Output of `netstat -tulpn | grep 3458` (is port in use?)
6. Output of `curl -v http://localhost:3458/api/health` (does it respond?)





