#!/bin/bash

# Test different chunk limits to compare performance
# This helps determine optimal chunk count for speed vs quality

echo "🧪 Testing Chunk Limit Performance"
echo "===================================="
echo ""

API_URL="http://localhost:3456/api/chat"
SESSION_ID=$(uuidgen)
QUESTION="What are the indications for dialysis?"

echo "Test Question: $QUESTION"
echo ""

# Function to test with specific chunk limit
test_chunk_limit() {
    local limit=$1
    echo "Testing with $limit chunks..."
    echo "-------------------------------"
    
    # Temporarily update the database
    psql $DATABASE_URL -c "UPDATE owners SET default_chunk_limit = $limit WHERE slug = 'ukidney';" > /dev/null 2>&1
    
    # Make request and extract timing
    local response=$(curl -s -X POST "$API_URL" \
      -H "Content-Type: application/json" \
      -d '{
        "message": "'"$QUESTION"'",
        "history": [],
        "model": "gemini",
        "sessionId": "'$SESSION_ID'",
        "doc": "smh"
      }')
    
    local total_time=$(echo $response | jq -r '.metadata.responseTime')
    local retrieval_time=$(echo $response | jq -r '.metadata.retrievalTime')
    local chunks_used=$(echo $response | jq -r '.metadata.chunksUsed')
    local response_length=$(echo $response | jq -r '.response | length')
    
    echo "  ✓ Total Time: ${total_time}ms"
    echo "  ✓ Retrieval: ${retrieval_time}ms"
    echo "  ✓ Chunks Used: $chunks_used"
    echo "  ✓ Response Length: $response_length chars"
    echo ""
}

# Test different chunk limits
test_chunk_limit 20
test_chunk_limit 30
test_chunk_limit 40
test_chunk_limit 50

# Restore original value
psql $DATABASE_URL -c "UPDATE owners SET default_chunk_limit = 50 WHERE slug = 'ukidney';" > /dev/null 2>&1

echo "===================================="
echo "✅ Tests completed!"
echo ""
echo "Compare the results to find optimal chunk count."
echo "Typically: Lower chunks = faster but less comprehensive"

