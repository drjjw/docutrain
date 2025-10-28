#!/bin/bash
echo "🔄 Restarting server..."

# Stop the current process
pm2 stop docutrainio-bot 2>/dev/null || true
pm2 delete docutrainio-bot 2>/dev/null || true

# Start fresh
pm2 start docutrainio-bot.js --env production

# Check status
pm2 status

echo "✅ Server restarted!"
