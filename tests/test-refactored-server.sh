#!/bin/bash

# Test script for refactored server
# Tests all major endpoints to ensure functionality is preserved

echo "=========================================="
echo "Testing Refactored Server Endpoints"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    
    echo -n "Testing: $description... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        echo "  Response: $body"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo "1. Health & Monitoring Endpoints"
echo "-----------------------------------"
test_endpoint "GET" "/api/health" "Health check"
test_endpoint "GET" "/api/ready" "Readiness check"
test_endpoint "GET" "/api/analytics?timeframe=24h" "Analytics endpoint"
echo ""

echo "2. Document Endpoints"
echo "-----------------------------------"
test_endpoint "GET" "/api/documents" "Document registry"
test_endpoint "GET" "/api/owners" "Owner configurations"
echo ""

echo "3. Cache Endpoints"
echo "-----------------------------------"
test_endpoint "GET" "/api/cache/stats" "Cache statistics"
echo ""

echo "4. Chat Endpoint (requires valid session)"
echo "-----------------------------------"
SESSION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
CHAT_DATA="{\"message\":\"What is this document about?\",\"history\":[],\"model\":\"gemini\",\"sessionId\":\"$SESSION_ID\",\"doc\":\"smh\"}"
test_endpoint "POST" "/api/chat" "Chat with single document" "$CHAT_DATA"
echo ""

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Check server logs.${NC}"
    exit 1
fi

