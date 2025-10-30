# Dedicated Processing VPS - Hardware & Setup Recommendations

## Hardware Requirements

### Minimum Specs (Small Scale)
- **CPU**: 2-4 cores (x86_64)
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Bandwidth**: 1TB/month
- **OS**: Ubuntu 22.04 LTS or Debian 12

### Recommended Specs (Medium Scale)
- **CPU**: 4-8 cores (x86_64)
- **RAM**: 8-16GB
- **Storage**: 50GB SSD
- **Bandwidth**: 2TB/month
- **OS**: Ubuntu 22.04 LTS or Debian 12

### High-Performance Specs (Large Scale)
- **CPU**: 8-16 cores (x86_64)
- **RAM**: 16-32GB
- **Storage**: 100GB+ NVMe SSD
- **Bandwidth**: 5TB+/month
- **OS**: Ubuntu 22.04 LTS or Debian 12

## Why These Specs?

### CPU Requirements
- **PDF parsing** (`pdf-parse`): CPU-intensive, especially for large/complex PDFs
- **Text processing** (chunking): Moderate CPU usage
- **OpenAI API calls**: Network I/O bound, but parallel batch processing helps
- **Multiple concurrent jobs**: More cores = more parallel processing

### RAM Requirements
- **PDF parsing**: ~100-500MB per document (depends on PDF size/complexity)
- **Text buffers**: ~10-50MB per document
- **Node.js runtime**: ~200-500MB base
- **Concurrent processing**: Multiply by number of simultaneous jobs
- **Example**: 4GB = ~4-8 concurrent documents safely

### Storage Requirements
- **OS + Node.js**: ~5GB
- **Application code**: ~1GB
- **Logs**: ~1-5GB (grows over time)
- **Temporary PDF storage**: ~10-20GB (for processing, not permanent)
- **Note**: PDFs are stored in Supabase Storage, not on VPS

### Network Requirements
- **Outbound to Supabase**: Database queries, storage downloads/uploads
- **Outbound to OpenAI**: Embedding API calls (bulk of traffic)
- **Inbound**: Minimal (worker polling or HTTP requests)
- **Typical**: 1-10MB per document processed

## Recommended VPS Providers

### Budget-Friendly Options
1. **DigitalOcean Droplets**
   - $24/month: 4GB RAM, 2 vCPU, 80GB SSD
   - $48/month: 8GB RAM, 4 vCPU, 160GB SSD
   - Easy setup, good documentation

2. **Linode**
   - $24/month: 4GB RAM, 2 vCPU, 80GB SSD
   - $48/month: 8GB RAM, 4 vCPU, 160GB SSD
   - Competitive pricing, good performance

3. **Hetzner Cloud**
   - €16/month: 4GB RAM, 2 vCPU, 80GB SSD
   - €32/month: 8GB RAM, 4 vCPU, 160GB SSD
   - Best price/performance in Europe

### Premium Options
1. **AWS EC2**
   - t3.medium: 4GB RAM, 2 vCPU (~$30/month)
   - t3.large: 8GB RAM, 4 vCPU (~$60/month)
   - More complex pricing, but scalable

2. **Google Cloud Compute Engine**
   - e2-medium: 4GB RAM, 2 vCPU (~$25/month)
   - e2-standard-4: 16GB RAM, 4 vCPU (~$100/month)
   - Good for scaling

### Specialized Options
1. **Vultr**
   - High-frequency instances: Better CPU performance
   - $24/month: 4GB RAM, 2 vCPU

2. **Contabo**
   - Very cheap but check performance
   - €9/month: 8GB RAM, 4 vCPU (may have limitations)

## OS Recommendations

### Ubuntu 22.04 LTS (Recommended)
- **Pros**: Most widely supported, excellent documentation, LTS = 5 years support
- **Package manager**: `apt`
- **Node.js**: Easy install via `nvm` or official repos

### Debian 12
- **Pros**: Lightweight, stable, secure
- **Cons**: Slightly older packages
- **Package manager**: `apt`

### Why Linux?
- ✅ Better performance than Windows for server workloads
- ✅ Lower resource overhead
- ✅ Excellent tooling (`pm2`, `systemd`, `nginx`)
- ✅ Cost-effective (most VPS providers optimize for Linux)

## Software Stack

### Required Software
```bash
# Node.js (latest LTS)
node --version  # v20.x or v22.x

# PM2 (process manager)
npm install -g pm2

# Git (for code deployment)
git --version

# Optional but recommended:
# - Nginx (reverse proxy if needed)
# - UFW (firewall)
# - Fail2ban (security)
```

### Application Dependencies
- Same as main VPS: `pdf-parse`, `@supabase/supabase-js`, `openai`
- Same Node.js version for consistency

## Network Considerations

### Security
- **Firewall**: Only open necessary ports (SSH, and worker API if HTTP-based)
- **SSH**: Use key-based authentication, disable password login
- **VPN/Private Network**: If both VPS on same provider, use private networking

### Connectivity
- **Latency to Supabase**: Lower is better (<50ms ideal)
- **Latency to OpenAI**: Less critical, but <100ms preferred
- **Bandwidth**: Most providers offer 1TB+ which is plenty

## Setup Checklist

### Initial Setup
- [ ] Provision VPS (Ubuntu 22.04 LTS recommended)
- [ ] Configure SSH key authentication
- [ ] Update system: `apt update && apt upgrade -y`
- [ ] Install Node.js (v20+ LTS)
- [ ] Install PM2: `npm install -g pm2`
- [ ] Clone repository
- [ ] Configure environment variables
- [ ] Set up firewall (UFW)

### Environment Variables Needed
```bash
# Database access
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_key

# Worker identification
WORKER_ID=vps2
WORKER_NAME=Processing-VPS-2

# Optional: Queue config
QUEUE_POLL_INTERVAL=5000  # 5 seconds
MAX_CONCURRENT_JOBS=2
```

### Monitoring Setup
- [ ] PM2 monitoring: `pm2 monit`
- [ ] Log rotation (PM2 handles this)
- [ ] Health check endpoint (if HTTP-based)
- [ ] Uptime monitoring (optional: UptimeRobot, etc.)

## Cost Estimates

### Monthly Costs (Processing VPS Only)
- **Budget**: $20-30/month (4GB RAM, 2 CPU)
- **Recommended**: $40-60/month (8GB RAM, 4 CPU)
- **High-Performance**: $100-200/month (16GB+ RAM, 8+ CPU)

### Additional Costs
- **Bandwidth**: Usually included (1-5TB/month)
- **Storage**: Usually included (50-100GB)
- **Monitoring**: Free (basic) to $10/month (advanced)

## Performance Optimization Tips

### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'worker-vps2',
    script: './lib/worker.js',
    instances: 1,  // Or match CPU cores
    exec_mode: 'fork',
    max_memory_restart: '2G',  // Restart if memory exceeds
    watch: false,
    autorestart: true,
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

### Node.js Optimization
- Use `--max-old-space-size` if needed: `node --max-old-space-size=3072`
- Enable HTTP keep-alive for API calls
- Use connection pooling for database

### System Optimization
- Disable unnecessary services
- Use swap if RAM is tight (but prioritize more RAM)
- Configure log rotation to prevent disk fill

## Testing Recommendations

### Before Production
1. **Load Test**: Process 10-20 documents simultaneously
2. **Memory Test**: Monitor RAM usage during peak load
3. **Failure Test**: Simulate VPS downtime (graceful handling)
4. **Network Test**: Verify connectivity to Supabase and OpenAI

## Migration Path

### Phase 1: Single VPS (Current)
- Main VPS handles everything

### Phase 2: Add Worker VPS
- Second VPS runs worker process
- Main VPS enqueues jobs
- Both can process (hybrid)

### Phase 3: Dedicated Processing
- Main VPS: API only
- Worker VPS: Processing only
- Can add more workers as needed

## Questions to Consider

1. **Do you need GPU?** No - PDF parsing and OpenAI API are CPU/network bound
2. **Do you need high-frequency CPU?** Yes - helps with PDF parsing speed
3. **Do you need NVMe storage?** Nice-to-have, not critical (PDFs are in Supabase)
4. **Multiple small VPS or one large?** Start with one medium, scale horizontally later

## Recommendation

**Start with:**
- **Provider**: DigitalOcean or Linode (easiest setup)
- **Specs**: 8GB RAM, 4 vCPU, 80GB SSD (~$48/month)
- **OS**: Ubuntu 22.04 LTS
- **Location**: Same region as your main VPS (lower latency)

This gives you headroom for growth and can easily scale to 2-4 concurrent document processing jobs.

