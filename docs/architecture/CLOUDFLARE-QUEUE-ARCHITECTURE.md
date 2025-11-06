# Cloudflare Queue Architecture for Document Processing

## Overview

Yes, you could use **Cloudflare Queues** (or **Durable Objects**) to manage the job queue instead of an in-memory queue. This would provide better scalability, persistence, and distributed coordination.

## Cloudflare Options

### Option 1: Cloudflare Queues (Recommended)

**Cloudflare Queues** is a managed queue service designed exactly for this use case.

#### Architecture:
```
User Request → Cloudflare Worker → Cloudflare Queue
                                      ↓
                              VPS Worker (polls queue)
                                      ↓
                              Process Document
                                      ↓
                              Update Status in Supabase
```

#### Benefits:
- ✅ **Persistent**: Queue survives server restarts
- ✅ **Scalable**: Can handle millions of messages
- ✅ **Reliable**: Built-in retry and dead-letter queues
- ✅ **No polling needed**: Can use webhooks/HTTP requests to notify VPS
- ✅ **Rate limiting**: Built-in rate limiting per consumer
- ✅ **Multiple consumers**: Can have multiple VPS instances processing

#### Implementation:
1. **Cloudflare Worker** (receives upload/process requests)
   - Validates request
   - Enqueues job to Cloudflare Queue
   - Returns `202 Accepted` immediately

2. **Cloudflare Queue** (manages job queue)
   - Stores pending jobs
   - Handles retries
   - Delivers to consumers

3. **VPS Worker** (processes jobs)
   - Option A: Polls queue via HTTP endpoint
   - Option B: Receives webhook from Cloudflare when jobs available
   - Processes document (PDF extraction, embeddings, etc.)
   - Updates Supabase with results

#### Code Example:

**Cloudflare Worker (enqueue.js):**
```javascript
export default {
  async fetch(request, env) {
    // Validate request
    const { user_document_id, user_id } = await request.json();
    
    // Enqueue job
    await env.DOCUMENT_QUEUE.send({
      user_document_id,
      user_id,
      timestamp: Date.now(),
      retries: 0
    });
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Document queued for processing',
      user_document_id,
      status: 'pending'
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

**VPS Worker (consumer.js):**
```javascript
// Poll Cloudflare Queue endpoint
async function pollQueue() {
  const response = await fetch('https://your-worker.workers.dev/queue/consume', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_QUEUE_TOKEN}`
    }
  });
  
  const jobs = await response.json();
  
  for (const job of jobs) {
    await processDocument(job.user_document_id);
  }
}

// Poll every 5 seconds
setInterval(pollQueue, 5000);
```

### Option 2: Cloudflare Durable Objects

**Durable Objects** are stateful Workers that can maintain queues in memory.

#### Benefits:
- ✅ **Stateful**: Can maintain queue state
- ✅ **Low latency**: In-memory queue
- ✅ **Coordination**: Can coordinate across multiple requests

#### Limitations:
- ⚠️ **Single instance**: One Durable Object = one queue (need sharding for scale)
- ⚠️ **Memory limits**: ~128MB per Durable Object
- ⚠️ **More complex**: Need to handle persistence, failover

### Option 3: Hybrid Approach (Current + Cloudflare)

Keep current in-memory queue but use Cloudflare for:
- **Rate limiting** at the edge
- **Request queuing** when capacity is full
- **Status updates** via webhooks

## Comparison: Current vs Cloudflare Queue

| Feature | Current (In-Memory) | Cloudflare Queue |
|---------|-------------------|------------------|
| **Persistence** | ❌ Lost on restart | ✅ Persistent |
| **Scalability** | ⚠️ Single server | ✅ Distributed |
| **Complexity** | ✅ Simple | ⚠️ More setup |
| **Cost** | ✅ Free (included) | 💰 ~$5/month + usage |
| **Latency** | ✅ Instant | ⚠️ Slight delay |
| **Multi-server** | ❌ No | ✅ Yes |
| **Reliability** | ⚠️ Server-dependent | ✅ High |

## Recommended Approach

### For Your Current Setup (Single VPS):

**Keep the current in-memory queue** because:
1. ✅ Simple and works well
2. ✅ No additional costs
3. ✅ Low latency
4. ✅ Your server has plenty of capacity (24 cores, 48GB RAM)
5. ✅ Jobs are persisted in database (`status: 'pending'`)

### When to Consider Cloudflare Queue:

Consider migrating if:
1. **Multiple VPS instances** - Need distributed queue
2. **High volume** - Processing 100+ documents simultaneously
3. **Need reliability** - Queue must survive server crashes
4. **Edge processing** - Want to do some work at the edge

## Implementation Plan (If You Want to Try It)

### Step 1: Set Up Cloudflare Queue

```bash
# Install Wrangler CLI
npm install -g wrangler

# Create queue
wrangler queues create document-processing-queue

# Create consumer
wrangler queues consumer create document-processing-queue \
  --script consumer.js \
  --batch-size 1 \
  --batch-timeout 5
```

### Step 2: Create Cloudflare Worker

**wrangler.toml:**
```toml
name = "docutrain-queue-worker"
main = "worker.js"
compatibility_date = "2024-01-01"

[[queues]]
producers = ["document-processing-queue"]
consumers = ["document-processing-queue"]
```

**worker.js:**
```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Enqueue endpoint
    if (url.pathname === '/enqueue' && request.method === 'POST') {
      const job = await request.json();
      await env.DOCUMENT_PROCESSING_QUEUE.send(job);
      return new Response(JSON.stringify({ success: true, queued: true }), {
        status: 202
      });
    }
    
    // Consumer endpoint (called by Cloudflare)
    if (url.pathname === '/consume' && request.method === 'POST') {
      const batch = await request.json();
      
      // Forward to VPS for processing
      for (const message of batch.messages) {
        await fetch('https://your-vps.com/api/process-queued-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message.body)
        });
      }
      
      return new Response(JSON.stringify({ success: true }));
    }
  }
};
```

### Step 3: Update VPS to Use Cloudflare Queue

Instead of in-memory queue, enqueue to Cloudflare:

```javascript
// In handlers
const response = await fetch('https://your-worker.workers.dev/enqueue', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_document_id,
    user_id,
    metadata: { ... }
  })
});
```

## Cost Estimate

**Cloudflare Queues:**
- **Free tier**: 1M operations/month
- **Paid**: $0.40 per million operations
- **Storage**: $0.20 per million messages stored

For your use case (probably <100k jobs/month), this would be **essentially free**.

## Recommendation

**For now, keep the current in-memory queue** because:
1. It works well for your single-server setup
2. Jobs are already persisted in database
3. No additional complexity or costs
4. Your server has plenty of capacity

**Consider Cloudflare Queue if:**
- You scale to multiple VPS instances
- You need guaranteed persistence across restarts
- You want to offload queue management

The current implementation is actually quite good for a single-server setup! The database already provides persistence (jobs with `status: 'pending'`), so even if the queue is lost on restart, you could rebuild it from the database.
