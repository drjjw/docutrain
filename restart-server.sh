#!/bin/bash
echo "🔄 Restarting server..."

# Stop the current process
pm2 stop manual-bot 2>/dev/null || true
pm2 delete manual-bot 2>/dev/null || true

# Start fresh
pm2 start ecosystem.config.js --env production

# Check status
pm2 status

echo "✅ Server restarted!"
