# Quiz Generation Optimization Guide

## Overview

Quiz generation can be slow for large question sets. This guide explains how to optimize quiz generation speed using different models and configuration options.

## Current Implementation

- **Model**: `gpt-4o-mini` (default)
- **Batch Size**: 20 questions per batch
- **Concurrency**: 3 parallel batches
- **Temperature**: 0.5 (lowered from 0.7 for speed)
- **Timeout**: 60 seconds per batch

## Speed Optimization Options

### 1. Use Faster Model (Recommended for Speed)

**Option A: GPT-3.5 Turbo** (Fastest, Cheapest)
```bash
export AI_QUIZ_MODEL=gpt-3.5-turbo
```
- ⚡ **2-3x faster** than gpt-4o-mini
- 💰 **~10x cheaper** than gpt-4o-mini
- ✅ Still produces good quality questions
- ⚠️ Slightly less nuanced than gpt-4o-mini

**Option B: GPT-4o Mini** (Current Default - Balanced)
```bash
export AI_QUIZ_MODEL=gpt-4o-mini
```
- ⚡ Moderate speed
- 💰 Moderate cost
- ✅ Good quality

**Option C: GPT-4o** (Highest Quality, Slowest)
```bash
export AI_QUIZ_MODEL=gpt-4o
```
- ⚡ Slower than gpt-4o-mini
- 💰 More expensive
- ✅ Highest quality questions

### 2. Increase Batch Size (More Questions Per API Call)

```bash
export AI_QUIZ_BATCH_SIZE=30  # Default: 20
```
- ⚡ **Faster**: Fewer API calls needed
- ⚠️ **Risk**: Higher chance of timeouts for large batches
- 💡 **Recommendation**: Start with 25-30, increase if stable

### 3. Increase Concurrency (More Parallel Batches)

```bash
export AI_QUIZ_CONCURRENCY=5  # Default: 3
```
- ⚡ **Faster**: More batches processed simultaneously
- ⚠️ **Risk**: May hit OpenAI rate limits
- 💡 **Recommendation**: Start with 4-5, monitor for rate limit errors

### 4. Lower Temperature (Faster Generation)

```bash
export AI_QUIZ_TEMPERATURE=0.3  # Default: 0.5
```
- ⚡ **Faster**: Lower temperature = faster token generation
- ✅ **More deterministic**: Less variation in output
- ⚠️ **Trade-off**: Slightly less creative questions

### 5. Increase Timeout (Prevent Premature Failures)

```bash
export AI_QUIZ_TIMEOUT=90000  # Default: 60000 (60 seconds)
```
- ⚡ Prevents timeouts for larger batches
- ⚠️ Slower failures if API is actually stuck

## Recommended Configurations

### 🚀 Speed-Optimized (Fastest)
```bash
export AI_QUIZ_MODEL=gpt-3.5-turbo
export AI_QUIZ_BATCH_SIZE=30
export AI_QUIZ_CONCURRENCY=5
export AI_QUIZ_TEMPERATURE=0.3
export AI_QUIZ_TIMEOUT=90000
```
**Expected Speed**: 2-3x faster than default
**Quality**: Good (slightly less nuanced)

### ⚖️ Balanced (Default)
```bash
export AI_QUIZ_MODEL=gpt-4o-mini
export AI_QUIZ_BATCH_SIZE=20
export AI_QUIZ_CONCURRENCY=3
export AI_QUIZ_TEMPERATURE=0.5
export AI_QUIZ_TIMEOUT=60000
```
**Expected Speed**: Baseline
**Quality**: Good

### 🎯 Quality-Optimized (Best Quality)
```bash
export AI_QUIZ_MODEL=gpt-4o
export AI_QUIZ_BATCH_SIZE=15
export AI_QUIZ_CONCURRENCY=2
export AI_QUIZ_TEMPERATURE=0.7
export AI_QUIZ_TIMEOUT=120000
```
**Expected Speed**: Slower
**Quality**: Highest

## Performance Comparison

For generating 100 questions:

| Configuration | Estimated Time | Cost (approx) |
|--------------|----------------|---------------|
| Speed-Optimized (gpt-3.5-turbo) | ~2-3 minutes | $0.10-0.15 |
| Balanced (gpt-4o-mini) | ~5-7 minutes | $0.50-0.70 |
| Quality-Optimized (gpt-4o) | ~10-15 minutes | $2.00-3.00 |

## Implementation Details

### Model Selection
- Quiz generation uses `AI_QUIZ_MODEL` if set, otherwise falls back to `AI_ABSTRACT_MODEL`
- This allows different models for abstracts vs quizzes

### Batching Strategy
- Questions > batch size are split into batches
- Batches processed in parallel (up to concurrency limit)
- Chunks distributed round-robin across batches for diversity

### Error Handling
- Failed batches are logged but don't stop generation
- Partial success: If 3/5 batches succeed, those questions are used
- Warning logged if not all questions generated

## Monitoring

Check logs for:
- `[quiz:progress]` entries showing batch progress
- Timeout errors (increase `AI_QUIZ_TIMEOUT`)
- Rate limit errors (decrease `AI_QUIZ_CONCURRENCY`)
- Failed batches (check OpenAI API status)

## Troubleshooting

### Timeouts
- **Symptom**: "Request timed out" errors
- **Fix**: Increase `AI_QUIZ_TIMEOUT` or decrease `AI_QUIZ_BATCH_SIZE`

### Rate Limits
- **Symptom**: 429 errors from OpenAI
- **Fix**: Decrease `AI_QUIZ_CONCURRENCY` or add delays between batches

### Low Quality Questions
- **Symptom**: Questions seem generic or off-topic
- **Fix**: Use `gpt-4o-mini` or `gpt-4o` instead of `gpt-3.5-turbo`

### Slow Generation
- **Symptom**: Taking longer than expected
- **Fix**: 
  1. Switch to `gpt-3.5-turbo`
  2. Increase `AI_QUIZ_BATCH_SIZE` to 30
  3. Increase `AI_QUIZ_CONCURRENCY` to 5
  4. Lower `AI_QUIZ_TEMPERATURE` to 0.3

## Environment Variables Summary

```bash
# Model selection
AI_QUIZ_MODEL=gpt-3.5-turbo          # Options: gpt-3.5-turbo, gpt-4o-mini, gpt-4o

# Batch configuration
AI_QUIZ_BATCH_SIZE=30                # Questions per batch (default: 20)
AI_QUIZ_CONCURRENCY=5                # Parallel batches (default: 3)

# Generation parameters
AI_QUIZ_TEMPERATURE=0.3               # 0.0-1.0, lower = faster (default: 0.5)
AI_QUIZ_TIMEOUT=90000                # Milliseconds per batch (default: 60000)
```

## Next Steps

1. **Try Speed-Optimized config** for faster generation
2. **Monitor logs** to see actual performance
3. **Adjust based on results** - find your sweet spot
4. **Consider quality vs speed trade-off** for your use case





