# Deployment Guide for brightbean.io

## 🚀 Deployment Location

**Target URL**: `https://brightbean.io/`

---

## 📦 **Files to Upload**

Upload these files to your server at `/home/ukidney/brightbean.io/` (web root of brightbean.io):

### **Required Files:**
```
/home/ukidney/brightbean.io/ (web root of brightbean.io)
├── server.js                                   # Node.js server
├── package.json                                # Dependencies
├── package-lock.json                           # Locked dependencies
├── .env                                        # Environment variables (secure!)
├── lib/
│   └── local-embeddings.js                    # Local embedding module
├── public/
│   ├── index.html                             # Chat interface
│   ├── css/
│   │   └── styles.*.css                       # Hashed CSS files
│   └── js/
│       └── *.js                               # Hashed JS modules
├── smh-manual-2023.pdf                        # SMH PDF document
├── uhn-manual-2025.pdf                        # UHN PDF document
├── embed-smh-manual.html                      # SMH embed page
└── embed-uhn-manual.html                      # UHN embed page
```

**Note**: The `.cache/` directory will be created automatically when using local embeddings.

### **Optional Files:**
```
├── README.md                      # Documentation
├── QUICKSTART.md                  # Quick start guide
├── UKIDNEY-INTEGRATION.md         # Integration instructions
└── embed-*.html                   # Embedding examples
```

---

## ⚙️ **Server Setup Steps**

### **Step 1: Install Node.js**
Ensure Node.js v18+ is installed on your server:
```bash
node --version  # Should be v18 or higher
```

### **Step 2: Upload Files**
```bash
# Upload all files to the server
scp -r /Users/jordanweinstein/Downloads/chat/* root@brightbean.io:/home/ukidney/brightbean.io/
```

### **Step 3: Install Dependencies**
```bash
cd /home/ukidney/brightbean.io/
npm install --production
```

### **Step 4: Configure Environment**
Create a `.env` file with your credentials:
```env
# AI Model API Keys
GEMINI_API_KEY=your_gemini_api_key_here
XAI_API_KEY=your_xai_api_key_here

# OpenAI (for RAG embeddings - optional if using local embeddings only)
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=3456

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# RAG Configuration (optional)
RAG_SIMILARITY_THRESHOLD=0.3
RAG_SIMILARITY_THRESHOLD_LOCAL=0.05

# Note: Local embeddings may be less accurate for specialized medical terminology
# compared to OpenAI embeddings. Use OpenAI embeddings for critical medical queries.
```

Get your API keys from:
- **Gemini**: [Google AI Studio](https://makersuite.google.com/)
- **Grok/xAI**: [xAI Console](https://console.x.ai/)
- **OpenAI**: [OpenAI Platform](https://platform.openai.com/)
- **Supabase**: [Supabase Dashboard](https://supabase.com/dashboard)

**Note**: `OPENAI_API_KEY` is optional if you're using local embeddings exclusively

### **Step 5: Start with PM2 (Process Manager)**
```bash
# Install PM2 globally
npm install -g pm2

# Start the application with ecosystem config (includes graceful restart)
pm2 start ecosystem.config.brightbean.js --env production

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
```

**Note**: The `ecosystem.config.brightbean.js` file provides:
- **Graceful shutdown**: Waits for active requests to complete (5 second timeout)
- **Health checks**: Automatic monitoring every 30 seconds
- **Zero-downtime restarts**: New process starts before old one stops
- **Automatic restart policies**: Smart restart logic with delays

### **Step 6: Configure Nginx Reverse Proxy**

Add this to your Nginx configuration:

```nginx
# In your brightbean.io nginx config
location /content/manuals/bot/ {
    proxy_pass http://localhost:3456/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Allow iframe embedding
    add_header X-Frame-Options "ALLOWALL" always;
}
```

Then reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## ⚙️ **URL Parameters & Configuration**

The chatbot supports multiple URL parameters for customization:

### **Available Parameters**

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `doc` | `smh`, `uhn` | `smh` | Select document (SMH Manual or UHN Manual) |
| `model` | `gemini`, `grok` | `gemini` | Select AI model |
| `method` | `full`, `rag` | `full` | Search mode (Comprehensive or Targeted) |
| `embedding` | `openai`, `local` | `openai` | Embedding type for RAG mode |

### **Usage Examples**

**Basic document selection:**
```
https://brightbean.io/?doc=uhn
```

**Select model:**
```
https://brightbean.io/?model=grok
```

**Use RAG mode with local embeddings:**
```
https://brightbean.io/?method=rag&embedding=local
```

**Full configuration:**
```
https://brightbean.io/?doc=uhn&model=grok&method=rag&embedding=local
```

### **Search Modes Explained**

**Comprehensive (Full Doc)** - `method=full` (default):
- Sends entire PDF to AI model
- Best for broad context questions
- More expensive (uses more tokens)
- Slower response times

**Targeted (RAG)** - `method=rag`:
- Uses vector similarity search
- Retrieves only top 5 relevant chunks
- Faster and more cost-effective
- Better for specific questions

### **Embedding Types (RAG Mode Only)**

**OpenAI** - `embedding=openai` (default):
- Uses OpenAI text-embedding-3-small API
- 1536-dimensional vectors
- Cost: ~$0.00002 per query
- Requires internet connection

**Local** - `embedding=local`:
- Uses all-MiniLM-L6-v2 model
- 384-dimensional vectors
- Cost: $0 (runs on server)
- Works offline after initial model download

### **Local Embeddings Setup** (Optional)

If using `embedding=local`, the server will:
1. Download the model (~23MB) on first request
2. Cache in `.cache/transformers/` directory
3. Use cached model for all subsequent requests

**First-time setup** (optional, speeds up first request):
```bash
cd /home/ukidney/brightbean.io/
npm run embed:local
```

This pre-downloads the model and generates embeddings (~5-10 minutes).

---

## 🌐 **Embed Code for UKidney.com Pages**

### **UIkit Modal (Recommended)**

Add this to any page on brightbean.io:

```html
<!-- Trigger Button (add anywhere on your page) -->
<button class="uk-button uk-button-primary" uk-toggle="target: #manual-assistant-modal">
    📚 Open Manual Assistant
</button>

<!-- Modal (add before </body>) -->
<div id="manual-assistant-modal" uk-modal>
    <div class="uk-modal-dialog uk-modal-body" style="width: 95vw; height: 95vh; max-width: 95vw; padding: 0;">
        <button class="uk-modal-close-default" type="button" uk-close></button>
        <iframe
            src="https://brightbean.io/"
            style="width: 100%; height: 100%; border: none;"
            title="UKidney Manual Assistant"
            allow="clipboard-write">
        </iframe>
    </div>
</div>
```

### **jQuery Modal**

```html
<!-- CSS (add to <head> or stylesheet) -->
<style>
.manual-modal-overlay {
    display: none; position: fixed; top: 0; left: 0;
    width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9998;
}
.manual-modal-container {
    display: none; position: fixed; top: 2.5vh; left: 2.5vw;
    width: 95vw; height: 95vh; background: white;
    border-radius: 8px; z-index: 9999;
}
.manual-modal-close {
    position: absolute; top: 10px; right: 10px;
    width: 40px; height: 40px; background: white;
    border: 2px solid #e0e0e0; border-radius: 50%;
    cursor: pointer; font-size: 24px; text-align: center; line-height: 36px;
}
.manual-modal-close:hover {
    background: #d32f2f; color: white; border-color: #d32f2f;
}
</style>

<!-- HTML (add to page) -->
<button id="openManualAssistant" style="background: #d32f2f; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer;">
    📚 Open Manual Assistant
</button>

<div class="manual-modal-overlay" id="manualModalOverlay"></div>
<div class="manual-modal-container" id="manualModalContainer">
    <button class="manual-modal-close" id="closeManualModal">&times;</button>
    <iframe
        src="https://brightbean.io/"
        style="width: 100%; height: 100%; border: none; border-radius: 8px;">
    </iframe>
</div>

<!-- JavaScript -->
<script>
$(function() {
    $('#openManualAssistant').click(function() {
        $('#manualModalOverlay, #manualModalContainer').fadeIn(300);
        $('body').css('overflow', 'hidden');
    });
    
    function closeModal() {
        $('#manualModalOverlay, #manualModalContainer').fadeOut(300);
        $('body').css('overflow', '');
    }
    
    $('#closeManualModal, #manualModalOverlay').click(closeModal);
    $(document).keydown(function(e) {
        if (e.key === 'Escape') closeModal();
    });
});
</script>
```

---

## 🔐 **Security Checklist**

Before deploying:

- [ ] ✅ `.env` file permissions set to 600
- [ ] ✅ `.env` excluded from git (already in `.gitignore`)
- [ ] ✅ HTTPS enabled on brightbean.io
- [ ] ✅ Firewall configured (only port 80/443 public)
- [ ] ✅ PM2 running with correct user
- [ ] ✅ Regular backups enabled

---

## 🧪 **Testing Before Going Live**

### **1. Test Locally with Production URL**
Update your local `.env` temporarily:
```env
PORT=3456
BASE_URL=https://brightbean.io/
```

### **2. Test on Server**
```bash
# SSH to server
cd /home/ukidney/brightbean.io/
npm start

# Test from browser
curl http://localhost:3456/api/health
```

### **3. Test Through Nginx**
```bash
curl https://brightbean.io/api/health
```

### **4. Test Modal Integration**
- Add modal code to a test page
- Verify iframe loads
- Test both AI models
- Check conversation logging

---

## 📊 **Post-Deployment Monitoring**

### **Check Logs:**
```bash
# PM2 logs
pm2 logs manual-bot

# Server logs
tail -f /var/log/nginx/access.log | grep "manuals/bot"
```

### **Analytics:**
```bash
curl https://brightbean.io/api/analytics?timeframe=24h
```

### **Database:**
Check Supabase dashboard for conversation logs:
https://supabase.com/dashboard/project/mlxctdgnojvkgfqldaob

---

## 🔄 **Updates & Maintenance**

### **Update PDF:**
```bash
cd /home/ukidney/brightbean.io/
# Upload new PDF (keep same filename or update server.js)
pm2 reload manual-bot  # Graceful reload with zero downtime
```

### **Update Code:**
```bash
git pull  # If using git
pm2 reload manual-bot  # Graceful reload with zero downtime
```

### **View Status:**
```bash
pm2 status manual-bot
pm2 monit  # Real-time monitoring
```

---

## 🆘 **Troubleshooting**

### **Chatbot not loading:**
1. Check PM2: `pm2 status`
2. Check logs: `pm2 logs manual-bot`
3. Test direct: `curl localhost:3456/api/health`
4. Check Nginx: `sudo nginx -t`

### **Analytics not working:**
1. Verify Supabase connection
2. Check RLS policies
3. Test: `curl http://localhost:3456/api/analytics`

### **PDF not loading:**
1. Check file path in `server.js`
2. Verify file permissions
3. Check server logs on startup

### **Local embeddings not working:**
1. Check if `.cache/transformers/` directory exists
2. Verify internet connection for initial model download
3. Check disk space (~25MB needed for model)
4. Check logs: `pm2 logs manual-bot | grep "embedding"`
5. Try pre-downloading: `npm run embed:local`

### **RAG mode timeout errors:**
1. Check if using `?method=rag` URL parameter
2. Verify Supabase connection
3. Check if `document_chunks` or `document_chunks_local` tables have data
4. Increase timeout if needed (currently 60s for RAG)
5. Check OpenAI API key if using OpenAI embeddings

### **URL parameters not working:**
1. Clear browser cache
2. Check console for URL parameter log
3. Verify format: `?param1=value1&param2=value2`
4. Make sure using supported values (e.g., `model=gemini` not `model=chatgpt`)

---

## 📋 **Quick Deploy Checklist**

- [ ] Upload files to `/home/ukidney/brightbean.io/`
- [ ] Run `npm install --production`
- [ ] Configure `.env` file
- [ ] Start with PM2: `pm2 start ecosystem.config.brightbean.js --env production`
- [ ] Configure Nginx reverse proxy
- [ ] Test: `curl https://brightbean.io/api/health`
- [ ] Add modal code to brightbean.io page
- [ ] Test modal from live site
- [ ] Monitor logs and analytics

---

## 🎯 **Final URLs**

- **Chatbot**: https://brightbean.io/
- **Health Check**: https://brightbean.io/api/health
- **Analytics**: https://brightbean.io/api/analytics
- **Supabase Dashboard**: https://supabase.com/dashboard/project/mlxctdgnojvkgfqldaob

---

## 🆕 **New Features & Enhancements**

### **Recent Updates** (October 2025)

1. **Dual Embedding System**
   - OpenAI embeddings (1536D) for high accuracy
   - Local embeddings (384D) for zero-cost operation
   - Switchable via `?embedding=` URL parameter
   - 100% chunk overlap proven in testing

2. **URL Parameter Control**
   - Full configuration via URL parameters
   - Model selection (`?model=grok` or `?model=gemini`)
   - Document selection (`?doc=smh` or `?doc=uhn`)
   - Method selection (`?method=rag` or `?method=full`)
   - Embedding selection (`?embedding=local` or `?embedding=openai`)

3. **Enhanced Error Handling**
   - 60-second timeout for RAG queries
   - 30-second timeout for full document queries
   - Clear, actionable error messages
   - Detailed server-side logging

4. **Console Debugging**
   - URL parameters displayed on page load
   - Embedding type and dimensions shown
   - Search mode clearly indicated
   - Model selection logged

5. **Performance Improvements**
   - Comprehensive server logging for debugging
   - Response time tracking
   - Chunk retrieval metrics
   - Error tracking with timestamps

### **For Developers**

**Test comparison between embeddings:**
```bash
npm run compare
```

**Generate local embeddings:**
```bash
npm run embed:local
```

**Build for production:**
```bash
npm run build
```

---

Your chatbot is ready for production deployment! 🚀

