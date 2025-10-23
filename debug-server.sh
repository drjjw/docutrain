#!/bin/bash
echo "🔧 Server Debug Script"
echo "====================="

echo -e "\n1. Check Node.js version:"
node --version
npm --version

echo -e "\n2. Check if dependencies are installed:"
if [ -d "node_modules" ]; then
    echo "✓ node_modules exists"
    ls -la node_modules | wc -l | xargs echo "   Files in node_modules:"
else
    echo "✗ node_modules missing! Run: npm install"
fi

echo -e "\n3. Check package.json:"
if [ -f "package.json" ]; then
    echo "✓ package.json exists"
else
    echo "✗ package.json missing!"
fi

echo -e "\n4. Check .env file:"
if [ -f ".env" ]; then
    echo "✓ .env exists"
    echo "   Environment variables:"
    grep -E "^[A-Z_]+" .env | wc -l | xargs echo "   Lines with env vars:"
else
    echo "✗ .env missing!"
fi

echo -e "\n5. Try to start server manually (will show errors):"
echo "   Running: timeout 10s node server.js"
timeout 10s node server.js 2>&1 | head -20
echo "   (Server startup attempt completed)"

echo -e "\n6. Check for port conflicts:"
netstat -tlnp | grep -E ":3456|:3000|:5000|:8000" || echo "   No common ports in use"

echo -e "\n7. Check disk space:"
df -h . | tail -1

echo -e "\n8. Check recent system logs:"
dmesg | tail -5 2>/dev/null || echo "   dmesg not available"
