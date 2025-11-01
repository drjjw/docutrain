# 4GB VPS Processing Capacity Analysis

## Current Processing Pipeline Bottlenecks

### 1. **OpenAI API Calls** (PRIMARY BOTTLENECK 🔴)
- **Impact**: HIGHEST - Sequential embedding generation
- **Current behavior**: One embedding at a time per document
- **Rate limits**: 
  - Tier 1: 3 requests/minute
  - Tier 2: 500 requests/minute
  - Tier 3: 3500 requests/minute
- **Typical document**: 10-50 chunks = 10-50 API calls
- **Time per embedding**: ~200-500ms (network latency)
- **Total time for 50 chunks**: ~10-25 seconds (just API calls)

### 2. **PDF Parsing** (CPU + Memory Intensive)
- **Memory per PDF**: ~100-500MB during parsing
- **CPU usage**: High during text extraction
- **Time**: 1-5 seconds per PDF (depends on size/complexity)
- **Concurrent limit**: Limited by RAM (each PDF needs buffer in memory)

### 3. **Text Chunking** (Moderate CPU)
- **Memory**: ~10-50MB per document
- **CPU**: Moderate (string operations)
- **Time**: <1 second typically
- **Concurrent limit**: Minimal - very fast

### 4. **Database Operations** (Network I/O)
- **Memory**: Negligible
- **Bottleneck**: Network latency to Supabase
- **Write operations**: 
  - Document metadata: 1 write
  - Chunks: Batch inserts (50 chunks/batch)
- **Time**: ~500ms-2s per document

### 5. **Network Downloads** (Supabase Storage)
- **Memory**: PDF buffer size (5-50MB typical)
- **Bottleneck**: Download speed
- **Time**: ~1-5 seconds (depends on size + bandwidth)

## Memory Analysis for 4GB VPS

### Base System Memory Usage
```
OS (Ubuntu):                ~300-400MB
Node.js Runtime:            ~200-500MB
PM2 Process Manager:       ~50-100MB
Base System Total:          ~550-1000MB
```

### Available for Processing
```
Total RAM:                  4096MB
Base System:               -1000MB (worst case)
Available:                 ~3100MB
```

### Memory Per Document Processing
```
PDF Buffer (download):      5-50MB      (depends on file size)
PDF Parsing (peak):       100-500MB    (during text extraction)
Text Chunks:               10-50MB     (after parsing)
OpenAI Requests:           Negligible   (just API calls)
Database Writes:           Negligible   (just network)
Total Peak per Document:   ~115-600MB  (varies by PDF size)
```

### Conservative Estimate (500MB per document)
```
Available RAM:             3100MB
Per Document:             500MB
Max Concurrent:           6 documents (3100 / 500)
Safe Concurrent:          4-5 documents (80% utilization)
```

### Optimistic Estimate (300MB per document)
```
Available RAM:             3100MB
Per Document:             300MB
Max Concurrent:           10 documents
Safe Concurrent:          7-8 documents
```

## Concurrency Model

### Current State (Sequential)
- Documents processed one at a time
- No queue system
- No parallel processing

### Recommended: Queue + Worker Pool

```javascript
// Worker configuration for 4GB VPS
const WORKER_CONFIG = {
  maxConcurrent: 3,        // Conservative: 3 parallel jobs
  queuePollInterval: 2000, // Check queue every 2 seconds
  memoryLimit: '3GB',      // PM2 memory limit
  restartOnCrash: true
};
```

### Concurrency Levels

#### Level 1: Conservative (3 concurrent)
- **RAM usage**: ~1.5GB (3 × 500MB)
- **Safety margin**: 1.6GB for system + spikes
- **Throughput**: ~3 documents every 15-30 seconds
- **Hourly capacity**: ~360-720 documents/hour
- **Daily capacity**: ~8,640-17,280 documents/day

#### Level 2: Moderate (4-5 concurrent)
- **RAM usage**: ~2-2.5GB
- **Safety margin**: ~1GB (tight)
- **Risk**: Possible OOM errors on large PDFs
- **Throughput**: ~4-5 documents every 15-30 seconds
- **Hourly capacity**: ~480-1200 documents/hour
- **Daily capacity**: ~11,520-28,800 documents/day

#### Level 3: Aggressive (6+ concurrent)
- **RAM usage**: ~3GB+
- **Risk**: HIGH - OOM errors likely
- **Not recommended** without swap or monitoring

## Bottleneck Breakdown

### Time Per Document (Typical 50-page PDF)
```
PDF Download:              2-5 seconds      (network I/O)
PDF Parsing:               2-5 seconds      (CPU intensive)
Text Chunking:             0.5 seconds     (CPU, fast)
AI Abstract Generation:   2-3 seconds      (OpenAI API, 1 call)
Embedding Generation:      10-25 seconds    (OpenAI API, 50 calls @ 200-500ms each)
Database Writes:           1-2 seconds     (network I/O)
────────────────────────────────────────────────────────
Total Processing Time:    17-40 seconds per document
```

### With 3 Concurrent Workers
```
Parallel processing: 3 documents simultaneously
Actual bottleneck: OpenAI API rate limits
Effective throughput: Limited by API, not CPU/RAM
```

## OpenAI API Rate Limits Impact

### Tier 1 (Default - 3 requests/minute)
- **Impact**: DEVASTATING 🔴
- **50 chunks**: 50 requests ÷ 3/min = **16.7 minutes minimum**
- **Reality**: ~20-30 minutes per document
- **Capacity**: ~3-6 documents/hour max
- **Not viable** for production

### Tier 2 (500 requests/minute)
- **Impact**: MANAGEABLE 🟡
- **50 chunks**: 50 requests ÷ 500/min = **0.1 minutes**
- **Reality**: ~20-30 seconds (after network latency)
- **Capacity**: ~120-180 documents/hour
- **Good for**: Medium scale

### Tier 3 (3500 requests/minute)
- **Impact**: EXCELLENT 🟢
- **50 chunks**: 50 requests ÷ 3500/min = **0.014 minutes**
- **Reality**: ~15-25 seconds
- **Capacity**: ~144-240 documents/hour
- **Best for**: High scale

### Rate Limit Strategy
```javascript
// Implement exponential backoff
const RATE_LIMIT_CONFIG = {
  maxRetries: 5,
  initialDelay: 1000,      // 1 second
  maxDelay: 60000,        // 60 seconds
  backoffMultiplier: 2
};

// Or implement request queuing
const OPENAI_QUEUE = {
  maxConcurrent: 10,      // Process 10 embeddings in parallel
  delayBetweenRequests: 100, // Small delay to avoid spikes
  batchSize: 50          // Group requests
};
```

## Capacity Estimates

### Scenario 1: Small Documents (10-20 chunks, 5MB PDFs)
```
Per document time:        ~10-15 seconds
With 3 concurrent:        ~5 seconds effective (parallel)
Documents per minute:     ~36 documents/minute
Documents per hour:        ~2,160 documents/hour
Documents per day:        ~51,840 documents/day
```

### Scenario 2: Medium Documents (30-50 chunks, 10-20MB PDFs)
```
Per document time:        ~20-30 seconds
With 3 concurrent:       ~7-10 seconds effective
Documents per minute:    ~18-25 documents/minute
Documents per hour:      ~1,080-1,500 documents/hour
Documents per day:       ~25,920-36,000 documents/day
```

### Scenario 3: Large Documents (100+ chunks, 50MB+ PDFs)
```
Per document time:        ~40-60 seconds
With 3 concurrent:       ~13-20 seconds effective
Documents per minute:    ~9-14 documents/minute
Documents per hour:      ~540-840 documents/hour
Documents per day:       ~12,960-20,160 documents/day
```

### Realistic Mixed Workload
```
Average document:         30 chunks, 10MB PDF
Average time:             ~25 seconds
With 3 concurrent:       ~8 seconds effective
Documents per hour:       ~1,350 documents/hour
Documents per day:        ~32,400 documents/day
```

## Implementation Recommendations

### 1. Queue System (Required)
```sql
-- Database queue table
CREATE TABLE processing_queue (
  id UUID PRIMARY KEY,
  user_document_id UUID UNIQUE,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_to TEXT, -- 'vps-worker-1'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Worker polls every 2 seconds
SELECT * FROM processing_queue 
WHERE status = 'pending' 
ORDER BY priority DESC, created_at ASC 
LIMIT 3  -- Max concurrent
FOR UPDATE SKIP LOCKED;
```

### 2. Worker Process (PM2)
```javascript
// lib/worker.js
const worker = {
  workerId: 'vps-worker-1',
  maxConcurrent: 3,
  currentJobs: new Set(),
  
  async start() {
    setInterval(async () => {
      if (this.currentJobs.size < this.maxConcurrent) {
        const job = await this.getNextJob();
        if (job) {
          this.processJob(job);
        }
      }
    }, 2000); // Poll every 2 seconds
  }
};
```

### 3. Memory Monitoring
```javascript
// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  const mbUsed = usage.heapUsed / 1024 / 1024;
  
  if (mbUsed > 2500) { // 2.5GB threshold
    console.warn('⚠️ High memory usage:', mbUsed, 'MB');
    // Pause accepting new jobs
  }
}, 5000);
```

### 4. OpenAI Rate Limit Handling
```javascript
// Implement request queuing with delays
class EmbeddingQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.delayBetweenRequests = 100; // 100ms between requests
  }
  
  async add(chunk) {
    return new Promise((resolve) => {
      this.queue.push({ chunk, resolve });
      this.process();
    });
  }
  
  async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    while (this.queue.length > 0) {
      const { chunk, resolve } = this.queue.shift();
      const embedding = await generateEmbedding(chunk);
      resolve(embedding);
      
      await sleep(this.delayBetweenRequests);
    }
    this.processing = false;
  }
}
```

## Capacity Summary

### 4GB VPS Capacity (Conservative - 3 concurrent)
| Metric | Value |
|--------|-------|
| **Max Concurrent Jobs** | 3 documents |
| **RAM Usage** | ~1.5GB (37% of total) |
| **Safe Margin** | ~1.6GB for system + spikes |
| **Documents/Hour** | ~1,350 (mixed workload) |
| **Documents/Day** | ~32,400 |
| **Documents/Month** | ~972,000 |
| **Primary Bottleneck** | OpenAI API rate limits |

### Scaling Beyond 4GB

#### Option 1: Upgrade to 8GB VPS
- **Max Concurrent**: 6-8 documents
- **Capacity**: ~2,700-3,600 documents/hour
- **Cost**: ~$48-60/month

#### Option 2: Add Second 4GB VPS
- **Max Concurrent**: 3 documents per VPS (6 total)
- **Capacity**: ~2,700 documents/hour
- **Cost**: ~$24-30/month per VPS
- **Benefit**: Redundancy + horizontal scaling

#### Option 3: Upgrade OpenAI Tier
- **Current**: Likely Tier 1 (3 req/min)
- **Tier 2**: 500 req/min ($200/month)
- **Tier 3**: 3500 req/min ($custom)
- **Benefit**: Removes API bottleneck

## Critical Considerations

### 1. Memory Spikes
- Large PDFs can spike to 500MB+ during parsing
- Always leave 1GB+ buffer for system
- Monitor and restart on OOM

### 2. Network Latency
- Latency to Supabase affects all operations
- Latency to OpenAI affects embedding generation
- Consider VPS location (same region as Supabase)

### 3. Failure Handling
- Implement retry logic for failed jobs
- Track retry count (max 3 retries)
- Dead letter queue for permanently failed jobs

### 4. Health Monitoring
- Memory usage alerts (>80%)
- CPU usage alerts (>90%)
- Queue depth alerts (>100 pending)
- Worker heartbeat (every 30 seconds)

## Recommended Setup

### Initial Configuration
```javascript
{
  workerId: 'vps-worker-1',
  maxConcurrent: 3,
  memoryLimit: '3GB',
  queuePollInterval: 2000,
  healthCheckInterval: 30000,
  maxRetries: 3,
  openaiRateLimit: {
    tier: 2, // Aim for Tier 2 minimum
    maxConcurrentRequests: 10,
    delayBetweenRequests: 100
  }
}
```

### Monitoring Dashboard
- Queue depth
- Active jobs
- Memory usage
- CPU usage
- Processing throughput (docs/hour)
- Error rate

## Conclusion

**4GB VPS Capacity:**
- ✅ **Safe concurrent**: 3 documents
- ✅ **Throughput**: ~1,350 documents/hour
- ✅ **Daily capacity**: ~32,400 documents
- ⚠️ **Bottleneck**: OpenAI API rate limits (not RAM/CPU)
- 💡 **Recommendation**: Start with 3 concurrent, monitor, scale horizontally

**Next Steps:**
1. Implement queue system
2. Configure worker with 3 concurrent jobs
3. Monitor memory and API usage
4. Scale to 8GB or add second VPS if needed
5. Upgrade OpenAI tier if API becomes bottleneck

