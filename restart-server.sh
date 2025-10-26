#!/bin/bash
echo "🔄 Restarting server..."

# Stop the current process
pm2 stop brightbean-bot 2>/dev/null || true
pm2 delete brightbean-bot 2>/dev/null || true

# Start fresh
pm2 start ecosystem.config.brightbean.js --env production

# Check status
pm2 status

echo "✅ Server restarted!"
