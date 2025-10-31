#!/bin/bash
echo "🔍 Server Diagnosis"
echo "=================="

echo -e "\n1. PM2 Status:"
pm2 status

echo -e "\n2. Check if Node processes are running:"
ps aux | grep node | grep -v grep

echo -e "\n3. Check port 3456:"
netstat -tlnp | grep :3456 || echo "Port 3456 not listening"

echo -e "\n4. Test server response:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3456/api/health || echo "Server not responding"

echo -e "\n5. Check server logs:"
tail -10 server.log 2>/dev/null || echo "No server.log found"
tail -10 server-error.log 2>/dev/null || echo "No server-error.log found"

echo -e "\n6. Check if .env exists:"
ls -la .env 2>/dev/null || echo ".env file missing!"
