#!/bin/bash

# Test script for lazy loading optimization
# Tests the /api/documents endpoint with different parameters

echo "🧪 Testing Lazy Loading API Endpoints"
echo "======================================"
echo ""

BASE_URL="http://localhost:3457"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test an endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_count="$3"
    
    echo -n "Testing: $name ... "
    
    # Make request and parse JSON
    response=$(curl -s "$url")
    
    # Check if response is valid JSON
    if ! echo "$response" | jq . > /dev/null 2>&1; then
        echo -e "${RED}FAIL${NC} - Invalid JSON response"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
    
    # Count documents
    doc_count=$(echo "$response" | jq '.documents | length')
    
    # Check if count matches expected
    if [ "$doc_count" = "$expected_count" ]; then
        echo -e "${GREEN}PASS${NC} - Returned $doc_count document(s)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC} - Expected $expected_count, got $doc_count"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Function to test that endpoint returns at least N documents
test_endpoint_min() {
    local name="$1"
    local url="$2"
    local min_count="$3"
    
    echo -n "Testing: $name ... "
    
    # Make request and parse JSON
    response=$(curl -s "$url")
    
    # Check if response is valid JSON
    if ! echo "$response" | jq . > /dev/null 2>&1; then
        echo -e "${RED}FAIL${NC} - Invalid JSON response"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
    
    # Count documents
    doc_count=$(echo "$response" | jq '.documents | length')
    
    # Check if count is at least min_count
    if [ "$doc_count" -ge "$min_count" ]; then
        echo -e "${GREEN}PASS${NC} - Returned $doc_count document(s) (>= $min_count)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC} - Expected at least $min_count, got $doc_count"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Function to test error response
test_error() {
    local name="$1"
    local url="$2"
    
    echo -n "Testing: $name ... "
    
    # Make request
    response=$(curl -s "$url")
    
    # Check if response contains error
    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC} - Returned error as expected"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC} - Expected error response"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo "1. Single Document Tests"
echo "------------------------"
test_endpoint "Single doc (smh)" "$BASE_URL/api/documents?doc=smh" "1"
test_endpoint "Single doc (uhn)" "$BASE_URL/api/documents?doc=uhn" "1"
test_endpoint "Single doc (ckd-dc-2025)" "$BASE_URL/api/documents?doc=ckd-dc-2025" "1"
echo ""

echo "2. Multi-Document Tests"
echo "-----------------------"
test_endpoint "Two docs (smh+uhn)" "$BASE_URL/api/documents?doc=smh+uhn" "2"
echo ""

echo "3. Owner Filter Tests"
echo "---------------------"
test_endpoint_min "Owner (ukidney)" "$BASE_URL/api/documents?owner=ukidney" "5"
echo ""

echo "4. Default/No Filter Tests"
echo "--------------------------"
test_endpoint_min "No filters (all docs)" "$BASE_URL/api/documents" "100"
echo ""

echo "5. Error Handling Tests"
echo "-----------------------"
test_error "Invalid document slug" "$BASE_URL/api/documents?doc=nonexistent"
test_error "Invalid owner slug" "$BASE_URL/api/documents?owner=nonexistent"
echo ""

echo "======================================"
echo "Test Results:"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi

