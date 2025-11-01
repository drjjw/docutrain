# How to Determine Your OpenAI Rate Limits

## Why I Don't Know Your Limits

I made assumptions in my capacity analysis based on OpenAI's default tiers:
- **Tier 1 (Default)**: 3 requests/minute - Very restrictive
- **Tier 2**: 500 requests/minute - $200/month minimum spend
- **Tier 3**: 3500 requests/minute - Custom pricing

**But your actual limits depend on:**
- Your OpenAI account tier
- Your usage history
- Your billing/spending level
- Custom limits OpenAI may have set

## How to Check Your Actual Limits

### Method 1: OpenAI Dashboard (Most Reliable)

1. **Go to**: https://platform.openai.com/account/limits
2. **Look for**:
   - **Rate limits** (requests per minute)
   - **Usage limits** (tokens per minute)
   - **Model-specific limits**

### Method 2: Monitor During Processing

When you process a document, watch for:

```bash
# Watch server logs for rate limit errors
pm2 logs docutrainio-bot | grep -i "rate\|429\|limit"

# Or check processing logs
tail -f dist/logs/document-processing.log | grep -i "rate\|429\|limit"
```

**What to look for:**
- `429` status codes
- Error messages like "Rate limit exceeded"
- Retry-after headers

### Method 3: Test Processing Speed

Process a document with known chunk count and time it:

```bash
# Process a test document
# Count: How many embeddings succeed per minute
# If you see: ~3 embeddings/minute → Tier 1
# If you see: ~50-500 embeddings/minute → Tier 2
# If you see: 500+ embeddings/minute → Tier 3
```

### Method 4: Check Usage Dashboard

1. **Go to**: https://platform.openai.com/usage
2. **Look for**:
   - Recent API calls
   - Rate limit errors
   - Usage patterns

## What Your Limits Mean for Capacity

### If Tier 1 (3 req/min):
```
50 chunks × 200ms = 10 seconds per embedding
But: 3 req/min = 1 request every 20 seconds
Reality: ~20-30 minutes per document 🔴
Capacity: ~3-6 documents/hour
```

### If Tier 2 (500 req/min):
```
50 chunks ÷ 500/min = 0.1 minutes minimum
Reality: ~20-30 seconds (network latency)
Capacity: ~120-180 documents/hour 🟢
```

### If Tier 3 (3500 req/min):
```
50 chunks ÷ 3500/min = 0.014 minutes minimum
Reality: ~15-25 seconds
Capacity: ~144-240 documents/hour 🚀
```

## Improving Rate Limit Detection

I've updated `lib/document-processor.js` to better detect rate limit errors (429 status codes). You'll now see clearer error messages when limits are hit.

## Next Steps

1. **Check your dashboard** to see actual limits
2. **Process a test document** and monitor the speed
3. **Update the capacity analysis** with your real limits
4. **Consider upgrading** if you hit Tier 1 limits frequently

## Upgrading Your Tier

If you're on Tier 1 and want to upgrade:

1. **Request increase**: https://platform.openai.com/account/limits
2. **Meet spending requirements**: Tier 2 requires $200/month
3. **Contact support**: For custom limits

Your actual capacity will be much higher if you're already on Tier 2 or 3!

