#!/bin/bash

# Fix missing dependencies issue
# Run this ON the remote server

echo "🔧 Fixing missing dependencies..."
echo "=================================="
echo ""

cd /home/docutrainio/public_html || exit 1

# Stop the process first
echo "🛑 Stopping PM2 process..."
pm2 stop docutrainio-bot 2>/dev/null || true
pm2 delete docutrainio-bot 2>/dev/null || true
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 node_modules missing - installing dependencies..."
else
    echo "📦 node_modules exists but may be incomplete - reinstalling..."
    echo "   (This may take a few minutes...)"
fi

# Install dependencies
npm install --production --legacy-peer-deps

# Verify express is installed
echo ""
echo "✅ Verifying express installation..."
if [ -d "node_modules/express" ]; then
    echo "✓ express module found"
else
    echo "❌ express module still missing - check npm install output above"
    exit 1
fi

# Start the server
echo ""
echo "🚀 Starting server..."
if [ -f docutrainio-bot.js ]; then
    pm2 start docutrainio-bot.js --env production
else
    pm2 start server.js --name docutrainio-bot
fi

pm2 save

echo ""
echo "⏳ Waiting 10 seconds for server to start..."
sleep 10

echo ""
echo "📊 PM2 Status:"
pm2 status docutrainio-bot

echo ""
echo "🔍 Checking server health..."
if curl -s -f http://localhost:3458/api/health > /dev/null 2>&1; then
    echo "✅ Server is responding!"
    curl -s http://localhost:3458/api/health | head -5
else
    echo "⚠️  Server may still be starting - check logs:"
    echo ""
    pm2 logs docutrainio-bot --lines 20 --nostream
fi

echo ""
echo "💡 To view logs: pm2 logs docutrainio-bot"
echo "💡 To monitor: pm2 monit"

