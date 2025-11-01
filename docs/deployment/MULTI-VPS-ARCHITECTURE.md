# Multi-VPS Processing Architecture Plan

## Current State
- Single VPS handles both API requests AND document processing
- Processing happens synchronously via `processUserDocument()` function
- No queue system - documents processed immediately when API endpoint is called

## Architecture Options

### Option 1: Database-Based Queue (Recommended for simplicity)
**Pros:** No additional infrastructure, uses existing Supabase database
**Cons:** Requires polling, less efficient than dedicated queue service

**Components Needed:**
1. **Processing Queue Table** - Store pending jobs
2. **Worker Service** - On second VPS, polls queue and processes documents
3. **Job Assignment Logic** - Route documents to available VPS
4. **Health Check System** - Track VPS availability

### Option 2: Redis Queue (Better for scale)
**Pros:** Fast, efficient, built-in job features
**Cons:** Requires Redis server (additional infrastructure)

**Components Needed:**
1. **Redis Server** - Queue storage
2. **Queue Library** - BullMQ or similar
3. **Worker Process** - On second VPS
4. **Health Monitoring** - Track workers

### Option 3: Message Queue Service (Most robust)
**Pros:** Most scalable, supports advanced features
**Cons:** Most complex setup (RabbitMQ, AWS SQS, etc.)

## Recommended: Database-Based Queue (Option 1)

### Database Schema Changes

```sql
-- Processing queue table
CREATE TABLE processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_document_id UUID NOT NULL REFERENCES user_documents(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'processing', 'completed', 'failed')),
    assigned_to TEXT, -- 'vps1', 'vps2', etc.
    assigned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0, -- Higher = more urgent
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_document_id) -- One queue entry per document
);

CREATE INDEX idx_processing_queue_status ON processing_queue(status, priority DESC, created_at);
CREATE INDEX idx_processing_queue_assigned ON processing_queue(assigned_to, status);

-- VPS worker registry
CREATE TABLE vps_workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id TEXT UNIQUE NOT NULL, -- 'vps1', 'vps2', etc.
    worker_name TEXT, -- Human-readable name
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'offline')),
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    max_concurrent_jobs INTEGER DEFAULT 1,
    current_jobs INTEGER DEFAULT 0,
    capabilities JSONB DEFAULT '{}', -- e.g., {"max_file_size": 10485760, "supports_edge_fallback": true}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vps_workers_status ON vps_workers(status, last_heartbeat);
```

### Implementation Components

#### 1. Queue Manager (`lib/queue-manager.js`)
```javascript
// Handles adding jobs to queue, assigning to workers, etc.
class QueueManager {
  async enqueue(userDocumentId, priority = 0) {
    // Insert into processing_queue
  }
  
  async assignJob(workerId) {
    // SELECT FOR UPDATE SKIP LOCKED
    // Get next pending job and assign to worker
  }
  
  async markComplete(jobId) {
    // Update queue entry
  }
}
```

#### 2. Worker Service (`lib/worker.js`)
```javascript
// Runs on second VPS - polls queue and processes documents
class Worker {
  constructor(workerId) {
    this.workerId = workerId;
    this.maxConcurrent = 1;
  }
  
  async start() {
    // Register with vps_workers table
    // Poll queue every 5 seconds
    // Process jobs
  }
  
  async heartbeat() {
    // Update last_heartbeat every 30 seconds
  }
  
  async processJob(job) {
    // Call processUserDocument() for assigned job
  }
}
```

#### 3. Updated Processing Route (`lib/routes/processing.js`)
```javascript
// Instead of processing directly:
if (processingMethod === 'vps') {
  // Add to queue instead of processing immediately
  await queueManager.enqueue(user_document_id, priority);
  return res.json({ success: true, status: 'queued' });
}
```

#### 4. Worker Script (`scripts/worker.js`)
```javascript
// Standalone script to run on second VPS
const worker = new Worker('vps2');
worker.start();

// PM2: pm2 start scripts/worker.js --name worker-vps2
```

## Alternative: Simple HTTP-Based Approach (No Queue)

If you want to avoid a queue system initially:

### Setup:
1. **Second VPS** runs a processing API endpoint
2. **Main VPS** makes HTTP requests to second VPS
3. **Load balancing** via round-robin or least-connections

### Code Changes:
```javascript
// lib/routes/processing.js
const VPS_WORKERS = [
  'http://vps1:3458',
  'http://vps2:3458'  // Second VPS
];

async function callVPSWorker(userDocumentId, workerUrl) {
  const response = await fetch(`${workerUrl}/internal/process`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${INTERNAL_API_KEY}` },
    body: JSON.stringify({ user_document_id: userDocumentId })
  });
  return response.json();
}
```

## What You Need

### Essential Components:
1. ✅ **Queue System** (database table OR Redis OR HTTP)
2. ✅ **Worker Process** on second VPS
3. ✅ **Health Monitoring** (heartbeat system)
4. ✅ **Job Assignment Logic** (round-robin, least-loaded, etc.)
5. ✅ **Failure Handling** (timeout, retry, reassign)

### Infrastructure:
- Second VPS server
- Shared database access (Supabase - already have)
- Optional: Redis server (if using Redis queue)
- Network connectivity between VPS servers

### Configuration:
- Environment variables for worker IDs
- Worker capability settings
- Retry/timeout policies

## Recommendation

**Start with Database-Based Queue** because:
- ✅ No additional infrastructure
- ✅ Uses existing Supabase database
- ✅ Easy to monitor via SQL queries
- ✅ Can scale to Redis later if needed

Want me to implement the database-based queue system?

