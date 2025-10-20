#!/bin/bash

# Batch training script for multiple documents
# Usage: ./batch-train.sh <embedding-type> <doc1> <doc2> ...
# Example: ./batch-train.sh openai uhn kdigo-ckd-2024

EMBEDDING_TYPE=$1
shift

if [ "$EMBEDDING_TYPE" = "openai" ]; then
    SCRIPT="chunk-and-embed.js"
elif [ "$EMBEDDING_TYPE" = "local" ]; then
    SCRIPT="chunk-and-embed-local.js"
else
    echo "Usage: $0 <openai|local> <doc1> <doc2> ..."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOTAL=$#
CURRENT=0
FAILED=0

echo "=========================================="
echo "Batch Training: $TOTAL documents"
echo "Embedding Type: $EMBEDDING_TYPE"
echo "=========================================="
echo ""

for DOC in "$@"; do
    CURRENT=$((CURRENT + 1))
    echo ""
    echo "[$CURRENT/$TOTAL] Processing: $DOC"
    echo "----------------------------------------"
    
    if node "$SCRIPT_DIR/$SCRIPT" --doc="$DOC"; then
        echo "✅ Success: $DOC"
    else
        echo "❌ Failed: $DOC"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "=========================================="
echo "Batch Complete"
echo "Total: $TOTAL"
echo "Succeeded: $((TOTAL - FAILED))"
echo "Failed: $FAILED"
echo "=========================================="

exit $FAILED

