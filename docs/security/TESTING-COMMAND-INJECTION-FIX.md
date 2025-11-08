# Testing Guide: Command Injection Fix

**Date:** January 2025  
**Fix:** Command injection vulnerability in `/api/monitoring/pm2/logs`

## Test Scenarios

### Prerequisites

1. **Set monitoring password** (if required):
   ```bash
   export MONITORING_PASSWORD=your_test_password
   ```

2. **Ensure PM2 is running** with at least one of these processes:
   - `docutrainio-bot`
   - `brightbean-bot`
   - `manual-bot`

3. **Get your server URL** (local or production):
   ```bash
   # Local
   BASE_URL="http://localhost:3458"
   
   # Production
   BASE_URL="https://www.docutrain.io"
   ```

---

## ✅ Test 1: Normal Functionality (Valid Process Names)

### Test with explicit process name
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot&lines=50&password=${MONITORING_PASSWORD}" \
  -H "X-Monitoring-Password: ${MONITORING_PASSWORD}"
```

**Expected:** ✅ Success response with logs

### Test with auto-detection (no app parameter)
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?lines=50&password=${MONITORING_PASSWORD}" \
  -H "X-Monitoring-Password: ${MONITORING_PASSWORD}"
```

**Expected:** ✅ Success response with logs from auto-detected process

### Test with different valid process names
```bash
# Test brightbean-bot
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=brightbean-bot&lines=50&password=${MONITORING_PASSWORD}"

# Test manual-bot
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=manual-bot&lines=50&password=${MONITORING_PASSWORD}"
```

**Expected:** ✅ Success response for each valid process name

---

## 🛡️ Test 2: Security - Invalid Process Names

### Test with invalid process name
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=invalid-process&lines=50&password=${MONITORING_PASSWORD}"
```

**Expected:** ❌ `400 Bad Request` with error: `"Invalid process name. Allowed processes: docutrainio-bot, brightbean-bot, manual-bot"`

### Test with empty process name
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=&lines=50&password=${MONITORING_PASSWORD}"
```

**Expected:** ❌ `400 Bad Request` (empty string not in whitelist)

---

## 🚨 Test 3: Security - Command Injection Attempts

### Test basic command injection
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot;ls&lines=50&password=${MONITORING_PASSWORD}"
```

**Expected:** ❌ `400 Bad Request` - Process name `docutrainio-bot;ls` not in whitelist

### Test command chaining
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot&&whoami&lines=50&password=${MONITORING_PASSWORD}"
```

**Expected:** ❌ `400 Bad Request` - Invalid process name rejected

### Test with shell metacharacters
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot\`id\`&lines=50&password=${MONITORING_PASSWORD}"
```

**Expected:** ❌ `400 Bad Request` - Invalid process name rejected

### Test with path traversal attempt
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=../../../etc/passwd&lines=50&password=${MONITORING_PASSWORD}"
```

**Expected:** ❌ `400 Bad Request` - Invalid process name rejected

### Test with SQL injection attempt (shouldn't matter but good to test)
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot' OR '1'='1&lines=50&password=${MONITORING_PASSWORD}"
```

**Expected:** ❌ `400 Bad Request` - Invalid process name rejected

---

## ✅ Test 4: Lines Parameter Validation

### Test valid lines parameter
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot&lines=100&password=${MONITORING_PASSWORD}"
```

**Expected:** ✅ Success with 100 lines

### Test default lines (no parameter)
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot&password=${MONITORING_PASSWORD}"
```

**Expected:** ✅ Success with default 100 lines

### Test minimum valid value
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot&lines=1&password=${MONITORING_PASSWORD}"
```

**Expected:** ✅ Success with 1 line

### Test maximum valid value
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot&lines=10000&password=${MONITORING_PASSWORD}"
```

**Expected:** ✅ Success with 10000 lines

### Test invalid lines parameter (too high)
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot&lines=10001&password=${MONITORING_PASSWORD}"
```

**Expected:** ❌ `400 Bad Request` with error: `"Lines parameter must be between 1 and 10000"`

### Test invalid lines parameter (negative)
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot&lines=-1&password=${MONITORING_PASSWORD}"
```

**Expected:** ❌ `400 Bad Request` with error: `"Lines parameter must be between 1 and 10000"`

### Test invalid lines parameter (zero)
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot&lines=0&password=${MONITORING_PASSWORD}"
```

**Expected:** ❌ `400 Bad Request` with error: `"Lines parameter must be between 1 and 10000"`

### Test invalid lines parameter (non-numeric)
```bash
curl -X GET "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot&lines=abc&password=${MONITORING_PASSWORD}"
```

**Expected:** ✅ Should default to 100 (parseInt returns NaN, which becomes 0, then defaults to 100)

---

## 🧪 Test 5: Integration Test Script

Create a test script to run all tests:

```bash
#!/bin/bash
# test-monitoring-fix.sh

BASE_URL="${BASE_URL:-http://localhost:3458}"
MONITORING_PASSWORD="${MONITORING_PASSWORD:-test123}"

echo "🧪 Testing Monitoring Routes Command Injection Fix"
echo "=================================================="
echo ""

# Test counter
PASSED=0
FAILED=0

test_case() {
    local name="$1"
    local url="$2"
    local expected_status="$3"
    local expected_text="$4"
    
    echo "Testing: $name"
    response=$(curl -s -w "\n%{http_code}" "$url")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" == "$expected_status" ]; then
        if [ -z "$expected_text" ] || echo "$body" | grep -q "$expected_text"; then
            echo "  ✅ PASSED (HTTP $http_code)"
            ((PASSED++))
        else
            echo "  ❌ FAILED - Expected text not found: $expected_text"
            echo "  Response: $body"
            ((FAILED++))
        fi
    else
        echo "  ❌ FAILED - Expected HTTP $expected_status, got $http_code"
        echo "  Response: $body"
        ((FAILED++))
    fi
    echo ""
}

# Valid tests
test_case "Valid process name" \
    "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot&lines=10&password=${MONITORING_PASSWORD}" \
    "200" "success"

test_case "Auto-detect process" \
    "${BASE_URL}/api/monitoring/pm2/logs?lines=10&password=${MONITORING_PASSWORD}" \
    "200" "success"

# Security tests
test_case "Invalid process name" \
    "${BASE_URL}/api/monitoring/pm2/logs?app=invalid-process&lines=10&password=${MONITORING_PASSWORD}" \
    "400" "Invalid process name"

test_case "Command injection attempt (semicolon)" \
    "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot;ls&lines=10&password=${MONITORING_PASSWORD}" \
    "400" "Invalid process name"

test_case "Command injection attempt (backtick)" \
    "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot\`id\`&lines=10&password=${MONITORING_PASSWORD}" \
    "400" "Invalid process name"

test_case "Lines too high" \
    "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot&lines=10001&password=${MONITORING_PASSWORD}" \
    "400" "Lines parameter must be between"

test_case "Lines negative" \
    "${BASE_URL}/api/monitoring/pm2/logs?app=docutrainio-bot&lines=-1&password=${MONITORING_PASSWORD}" \
    "400" "Lines parameter must be between"

echo "=================================================="
echo "Results: $PASSED passed, $FAILED failed"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "✅ All tests passed!"
    exit 0
else
    echo "❌ Some tests failed"
    exit 1
fi
```

**Usage:**
```bash
chmod +x test-monitoring-fix.sh
./test-monitoring-fix.sh
```

---

## 🔍 Manual Verification Steps

### 1. Check Server Logs

Watch server logs while running tests to ensure:
- No shell commands are being executed
- Error messages are appropriate
- No unexpected errors occur

```bash
# In another terminal
tail -f server.log
# or
pm2 logs docutrainio-bot
```

### 2. Verify PM2 Processes

Ensure your PM2 processes are running:
```bash
pm2 list
```

Should show at least one of: `docutrainio-bot`, `brightbean-bot`, or `manual-bot`

### 3. Test in Browser (if monitoring UI exists)

If you have a monitoring UI, test through the browser:
1. Navigate to monitoring page
2. Try selecting different process names
3. Verify logs load correctly
4. Try entering invalid process names in URL

---

## ✅ Expected Results Summary

| Test Case | Expected Result |
|-----------|----------------|
| Valid process name | ✅ 200 OK with logs |
| Auto-detect (no app param) | ✅ 200 OK with logs |
| Invalid process name | ❌ 400 Bad Request |
| Command injection attempts | ❌ 400 Bad Request |
| Valid lines (1-10000) | ✅ 200 OK |
| Invalid lines (<1 or >10000) | ❌ 400 Bad Request |
| Non-numeric lines | ✅ Defaults to 100 |

---

## 🐛 Troubleshooting

### If tests fail:

1. **Check authentication:**
   ```bash
   # Verify password is set
   echo $MONITORING_PASSWORD
   ```

2. **Check PM2 processes:**
   ```bash
   pm2 jlist | grep -E "docutrainio-bot|brightbean-bot|manual-bot"
   ```

3. **Check server is running:**
   ```bash
   curl http://localhost:3458/api/health
   ```

4. **Check server logs for errors:**
   ```bash
   pm2 logs docutrainio-bot --lines 50
   ```

5. **Verify code changes:**
   ```bash
   grep -A 5 "ALLOWED_PM2_PROCESSES" lib/routes/monitoring.js
   grep -A 5 "execFilePromise" lib/routes/monitoring.js
   ```

---

## 📝 Notes

- All command injection attempts should be blocked **before** any command execution
- The whitelist validation happens **before** `execFile` is called
- `execFile` is safer than `exec` because it doesn't spawn a shell
- Even if whitelist validation somehow fails, `execFile` with array arguments prevents shell injection

---

**Last Updated:** January 2025  
**Fix Status:** ✅ Implemented and ready for testing

