#!/bin/bash

# Test script to validate chat optimizations
# Run this before and after deploying optimizations to compare performance

echo "🧪 Testing Chat Performance Optimizations"
echo "=========================================="
echo ""

# Configuration
API_URL="http://localhost:3456/api/chat"
SESSION_ID=$(uuidgen)

# Test 1: Single document query
echo "Test 1: Single Document Query (smh)"
echo "-----------------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the indications for dialysis?",
    "history": [],
    "model": "gemini",
    "sessionId": "'$SESSION_ID'",
    "doc": "smh"
  }' | jq '.metadata.responseTime'

echo ""
echo ""

# Test 2: Multi-document query (5 documents)
echo "Test 2: Multi-Document Query (5 documents)"
echo "-------------------------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the indications for dialysis?",
    "history": [],
    "model": "gemini",
    "sessionId": "'$SESSION_ID'",
    "doc": "smh+smh-tx+kdigo-ckd-2024+kdigo-aki-2012+kdoqi-hemodialysis-2015"
  }' | jq '.metadata.responseTime'

echo ""
echo ""

# Test 3: Check server logs for timing breakdown
echo "Test 3: Check Server Logs for Timing Breakdown"
echo "-----------------------------------------------"
echo "Look for the last request in server logs:"
echo ""
echo "Expected output should show:"
echo "  ⏱️  Auth: XXms (X.X%)"
echo "  ⏱️  Registry: XXms (X.X%)"
echo "  ⏱️  Embedding: XXms (X.X%)"
echo "  ⏱️  Retrieval: XXms (X.X%)"
echo "  ⏱️  Generation: XXms (X.X%)"
echo ""
echo "Run: tail -n 50 server.log | grep '⏱️'"
echo ""

echo "=========================================="
echo "✅ Tests completed!"
echo ""
echo "Compare response times:"
echo "  - Single doc: Should be ~1500-2500ms"
echo "  - Multi doc (5): Should be ~2300-3200ms (20-25% faster than before)"
echo ""
echo "Check server logs for detailed timing breakdown."

