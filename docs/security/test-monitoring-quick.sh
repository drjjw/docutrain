#!/bin/bash
# Quick test script for monitoring route command injection fix

BASE_URL="${BASE_URL:-http://localhost:3458}"
MONITORING_PASSWORD="${MONITORING_PASSWORD:-}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 Quick Test: Monitoring Route Command Injection Fix${NC}"
echo "=================================================="
echo ""

# Check if password is needed
if [ -z "$MONITORING_PASSWORD" ]; then
    echo -e "${YELLOW}⚠️  MONITORING_PASSWORD not set - testing without auth${NC}"
    AUTH_PARAM=""
else
    AUTH_PARAM="&password=${MONITORING_PASSWORD}"
fi

# Test 1: Valid process name
echo "Test 1: Valid process name (docutrainio-bot)"
response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot&lines=5${AUTH_PARAM}")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✅ PASSED${NC}"
else
    echo -e "${RED}❌ FAILED (HTTP $http_code)${NC}"
    echo "Response: $(echo "$response" | head -n-1)"
fi
echo ""

# Test 2: Invalid process name
echo "Test 2: Invalid process name (should be rejected)"
response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/monitoring/pm2/logs?app=invalid-process&lines=5${AUTH_PARAM}")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" == "400" ]; then
    echo -e "${GREEN}✅ PASSED - Correctly rejected invalid process${NC}"
else
    echo -e "${RED}❌ FAILED - Should return 400, got $http_code${NC}"
    echo "Response: $(echo "$response" | head -n-1)"
fi
echo ""

# Test 3: Command injection attempt
echo "Test 3: Command injection attempt (should be rejected)"
response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot;ls&lines=5${AUTH_PARAM}")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" == "400" ]; then
    echo -e "${GREEN}✅ PASSED - Command injection blocked${NC}"
else
    echo -e "${RED}❌ FAILED - Should return 400, got $http_code${NC}"
    echo "Response: $(echo "$response" | head -n-1)"
fi
echo ""

# Test 4: Auto-detect (no app parameter)
echo "Test 4: Auto-detect process (no app parameter)"
response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/monitoring/pm2/logs?lines=5${AUTH_PARAM}")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✅ PASSED - Auto-detection works${NC}"
else
    echo -e "${YELLOW}⚠️  Auto-detect returned $http_code (may need valid PM2 process)${NC}"
fi
echo ""

# Test 5: Lines validation (too high)
echo "Test 5: Lines parameter validation (too high)"
response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot&lines=10001${AUTH_PARAM}")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" == "400" ]; then
    echo -e "${GREEN}✅ PASSED - Lines validation works${NC}"
else
    echo -e "${RED}❌ FAILED - Should return 400 for invalid lines, got $http_code${NC}"
fi
echo ""

echo "=================================================="
echo -e "${YELLOW}💡 Tip: Set BASE_URL and MONITORING_PASSWORD environment variables to test different environments${NC}"
echo "Example: BASE_URL=https://www.docutrain.io MONITORING_PASSWORD=yourpass ./test-monitoring-quick.sh"

