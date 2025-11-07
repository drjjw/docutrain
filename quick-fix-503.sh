#!/bin/bash

# Quick fix script for 503 errors
# Run this ON the remote server

echo "🔧 Quick Fix for 503 Error"
echo "=========================="
echo ""

cd /home/docutrainio/public_html || exit 1

# Check current status
echo "📊 Current PM2 status:"
pm2 status docutrainio-bot 2>/dev/null || echo "Process not found"
echo ""

# Stop and delete existing process
echo "🛑 Stopping existing process..."
pm2 stop docutrainio-bot 2>/dev/null || true
pm2 delete docutrainio-bot 2>/dev/null || true
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  WARNING: .env file not found!"
    echo "   You may need to recreate it with your environment variables"
    echo ""
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install --production --legacy-peer-deps
    echo ""
fi

# Try to start with ecosystem config if it exists
if [ -f docutrainio-bot.js ]; then
    echo "🚀 Starting with PM2 ecosystem config..."
    pm2 start docutrainio-bot.js --env production
else
    echo "🚀 Starting with basic PM2 command..."
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
    echo "❌ Server is NOT responding"
    echo ""
    echo "📋 Recent logs:"
    pm2 logs docutrainio-bot --lines 30 --nostream
fi

echo ""
echo "💡 To view logs: pm2 logs docutrainio-bot"
echo "💡 To monitor: pm2 monit"

