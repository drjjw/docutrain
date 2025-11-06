#!/bin/bash
# Script to verify the timeout manager fix is deployed on production

echo "=========================================="
echo "Verifying Timeout Manager Fix Deployment"
echo "=========================================="
echo ""

PROD_PATH="/home/docutrainio/public_html/lib/processors/ai-content-generator.js"

echo "1. Checking if file exists..."
if [ -f "$PROD_PATH" ]; then
    echo "   ✓ File exists: $PROD_PATH"
else
    echo "   ✗ File NOT found: $PROD_PATH"
    exit 1
fi

echo ""
echo "2. Checking for separate timeout managers (FIX KEY INDICATOR)..."
if grep -q "const abstractTimeoutManager = createTimeoutManager()" "$PROD_PATH" && \
   grep -q "const keywordsTimeoutManager = createTimeoutManager()" "$PROD_PATH"; then
    echo "   ✓ FIX DEPLOYED: Separate timeout managers found"
else
    echo "   ✗ FIX NOT DEPLOYED: Separate timeout managers NOT found"
    echo "   This means the old buggy code is still running!"
    exit 1
fi

echo ""
echo "3. Checking for shouldCleanup logic..."
if grep -q "const shouldCleanup = !options.timeoutManager" "$PROD_PATH"; then
    echo "   ✓ shouldCleanup logic found"
else
    echo "   ✗ shouldCleanup logic NOT found"
fi

echo ""
echo "4. Checking for cleanup condition..."
if grep -q "if (shouldCleanup)" "$PROD_PATH"; then
    echo "   ✓ Conditional cleanup found"
else
    echo "   ✗ Conditional cleanup NOT found"
fi

echo ""
echo "5. Showing relevant code sections..."
echo ""
echo "--- generateAbstractAndKeywords function (should show separate managers):"
grep -A 5 "Create separate timeout managers" "$PROD_PATH" | head -6
echo ""
echo "--- generateAbstract function (should show shouldCleanup):"
grep -A 3 "const shouldCleanup" "$PROD_PATH" | head -4
echo ""

echo "=========================================="
echo "Verification Complete"
echo "=========================================="

