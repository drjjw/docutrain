#!/bin/bash
# Script to clear backend cache on deployed server
# This can be run manually via SSH or added to deploy.sh

echo "🗑️  Clearing backend document registry cache..."

# SSH into server and call the refresh endpoint
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 \
  "curl -X POST http://localhost:3458/api/refresh-registry && echo '' && echo '✅ Backend cache cleared'"

echo ""
echo "💡 If the endpoint doesn't exist or returns an error, the server cache"
echo "   will be cleared automatically when you restart the server (pm2 restart)."

