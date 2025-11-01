# Production Deployment Checklist

## 📋 Pre-Deployment Checklist

### **Files Ready** ✅
- [x] server.js
- [x] package.json  
- [x] .env (with API keys)
- [x] public/index.html
- [x] SMH Nephrology Housestaff Manual.- 2023.pdf

### **Configuration**
- [ ] Update `.env` PORT if needed (default: 3000)
- [ ] Verify all API keys are valid
- [ ] Test locally one final time

---

## 🚀 Deployment Steps

### **1. Upload to Server**

Upload these files to: `/home/ukidney/brightbean.io/` (web root of brightbean.io)

**Method A - SCP:**
```bash
scp -r /Users/jordanweinstein/Downloads/chat/* root@brightbean.io:/home/ukidney/brightbean.io/
```

**Method B - RSYNC (preferred):**
```bash
rsync -avz --exclude 'node_modules' \
  /Users/jordanweinstein/Downloads/chat/ \
  root@brightbean.io:/home/ukidney/brightbean.io/
```

**Method C - FTP/SFTP:**
Use your FTP client (FileZilla, Transmit, etc.)

---

### **2. Server Setup**

SSH into your server:
```bash
ssh root@brightbean.io
cd /home/ukidney/brightbean.io/
```

Install dependencies:
```bash
npm install --production
```

Test locally on server:
```bash
npm start
# Should see: "✓ PDF loaded successfully"
# CTRL+C to stop
```

---

### **3. Setup PM2 (Process Manager)**

Install PM2 globally:
```bash
sudo npm install -g pm2
```

Start the application:
```bash
pm2 start server.js --name "manual-bot"
pm2 save
pm2 startup  # Follow the instructions it gives you
```

Verify it's running:
```bash
pm2 status
pm2 logs manual-bot --lines 50
```

---

### **4. Configure Nginx**

Edit your Nginx config:
```bash
sudo nano /etc/nginx/sites-available/brightbean.io
```

Add this location block:
```nginx
server {
    server_name brightbean.io www.brightbean.io;
    
    # ... existing configuration ...
    
    # Manual Assistant Chatbot
    location /content/manuals/bot/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers for iframe embedding
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type" always;
    }
}
```

Test and reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### **5. Test Deployment**

Test the API:
```bash
curl https://brightbean.io/content/manuals/bot/api/health
```

Expected response:
```json
{
  "status": "ok",
  "pdfLoaded": true,
  "document": "SMH Nephrology Housestaff Manual.- 2023.pdf",
  "documentVersion": "2023",
  "pdfPages": 193,
  "pdfCharacters": 297337
}
```

Test in browser:
```
https://brightbean.io/content/manuals/bot/
```

---

### **6. Add to UKidney.com Page**

Edit your brightbean.io page template and add:

```html
<!-- Anywhere on your page -->
<button class="uk-button uk-button-primary" uk-toggle="target: #manual-assistant-modal">
    📚 Search Manual
</button>

<!-- Before </body> -->
<div id="manual-assistant-modal" uk-modal>
    <div class="uk-modal-dialog uk-modal-body" style="width: 95vw; height: 95vh; max-width: 95vw; padding: 0;">
        <button class="uk-modal-close-default" type="button" uk-close></button>
        <iframe 
            src="https://brightbean.io/content/manuals/bot/"
            style="width: 100%; height: 100%; border: none;">
        </iframe>
    </div>
</div>
```

---

### **7. Security Hardening**

Secure the .env file:
```bash
chmod 600 /home/ukidney/brightbean.io/.env
```

Set proper ownership:
```bash
sudo chown -R www-data:www-data /home/ukidney/brightbean.io/
```

Configure firewall (if UFW):
```bash
sudo ufw status
# Ensure only 80, 443, and SSH are open
```

---

## ✅ Post-Deployment Verification

### **Functional Tests**
- [ ] Chatbot loads at https://brightbean.io/content/manuals/bot/
- [ ] Can ask questions and get responses
- [ ] Gemini model works
- [ ] Grok model works
- [ ] Modal opens on brightbean.io page
- [ ] Modal closes properly (ESC, click outside, X button)
- [ ] Mobile responsive
- [ ] Conversations logged to Supabase

### **Performance Tests**
- [ ] First load < 3 seconds
- [ ] Response time < 10 seconds
- [ ] No console errors
- [ ] Tables render properly
- [ ] Markdown formatting works

### **Analytics Tests**
- [ ] Visit: https://brightbean.io/content/manuals/bot/api/analytics
- [ ] See conversation count
- [ ] Check Supabase dashboard
- [ ] Verify document tracking

---

## 📊 Monitoring

### **PM2 Commands**
```bash
pm2 status                    # Check if running
pm2 logs manual-bot          # View logs
pm2 logs manual-bot --lines 100  # Last 100 lines
pm2 monit                    # Real-time monitoring
pm2 restart manual-bot       # Restart if needed
pm2 stop manual-bot          # Stop
pm2 start manual-bot         # Start
```

### **Check Analytics**
```bash
curl https://brightbean.io/content/manuals/bot/api/analytics?timeframe=24h | jq
```

### **Supabase Dashboard**
https://supabase.com/dashboard/project/mlxctdgnojvkgfqldaob/editor

---

## 🔄 Updates

### **To Update PDF:**
```bash
# Upload new PDF to server
scp "New Manual.pdf" root@brightbean.io:/home/ukidney/brightbean.io/

# SSH to server
ssh root@brightbean.io
cd /home/ukidney/brightbean.io/

# Update server.js with new filename
nano server.js  # Change line 75

# Restart
pm2 restart manual-bot
```

### **To Update Code:**
```bash
# Upload changed files
scp server.js root@brightbean.io:/home/ukidney/brightbean.io/

# Restart
pm2 restart manual-bot
```

---

## 🆘 Troubleshooting

### **Bot not loading:**
1. Check PM2: `pm2 status`
2. Check logs: `pm2 logs manual-bot --err`
3. Test local: `curl localhost:3000/api/health`
4. Check Nginx: `sudo nginx -t && sudo systemctl status nginx`

### **502 Bad Gateway:**
- PM2 not running: `pm2 start manual-bot`
- Wrong port in Nginx config
- Firewall blocking internal port

### **Analytics not working:**
- Check Supabase connection
- Verify RLS policies allow anon reads
- Check `.env` has correct Supabase keys

### **Slow responses:**
- Check server resources: `htop`
- Monitor API quotas (Gemini/Grok)
- Check network latency

---

## 📞 Support URLs

- **Supabase Dashboard**: https://supabase.com/dashboard/project/mlxctdgnojvkgfqldaob
- **Gemini API Console**: https://makersuite.google.com/app/apikey
- **Grok API**: https://x.ai/api

---

## ✅ Final Checklist

- [ ] All files uploaded
- [ ] Dependencies installed
- [ ] PM2 running and saved
- [ ] Nginx configured and reloaded
- [ ] HTTPS working
- [ ] Modal integrated on brightbean.io
- [ ] Tested both AI models
- [ ] Analytics working
- [ ] Supabase logging confirmed
- [ ] Mobile tested
- [ ] Documentation reviewed

---

**Your chatbot is production-ready!** 🎉

