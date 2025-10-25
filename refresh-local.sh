#!/bin/bash
# Quick script to refresh local document registry cache
# Usage: ./refresh-local.sh

echo "🔄 Refreshing local document registry..."
curl -X POST http://localhost:3456/api/refresh-registry
echo ""
echo "✅ Local cache refreshed! Reload your browser page."

