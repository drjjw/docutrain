# Domain Switching Guide: doxcite.com ↔ brightbean.io

This guide explains how to switch between two configurations:
- **doxcite.com** on port 3457 with PM2 process `doxcite-bot`
- **brightbean.io** on port 3456 with PM2 process `manual-bot`

## Current Configuration (doxcite.com on 3457)

### Server Configuration
```javascript
// server.js line 19
const PORT = process.env.PORT || 3457;
```

### PM2 Configuration
```javascript
// ecosystem.config.brightbean.js
{
  name: 'doxcite-bot',
  // ... other config
}
```

### Environment Variables
```bash
# .env on server
PORT=3457
```

### Apache Virtual Host
```apache
# /etc/apache2/sites-available/doxcite.conf
<VirtualHost *:80>
    ServerName doxcite.com
    ServerAlias www.doxcite.com

    ProxyPass / http://127.0.0.1:3457/
    ProxyPassReverse / http://127.0.0.1:3457/

    <IfModule mod_headers.c>
        Header set Access-Control-Allow-Origin "*"
        Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
        Header set Access-Control-Allow-Headers "Content-Type"
    </IfModule>
</VirtualHost>
```

---

## Switching to brightbean.io Configuration

### 1. Update Server Port
```bash
# Change server.js line 19 from:
const PORT = process.env.PORT || 3457;
# To:
const PORT = process.env.PORT || 3456;
```

### 2. Update PM2 Process Name
```bash
# Change ecosystem.config.brightbean.js from:
name: 'doxcite-bot',
# To:
name: 'manual-bot',
```

### 3. Update Environment Variables
```bash
# Change .env on server from:
PORT=3457
# To:
PORT=3456
```

### 4. Update Apache Virtual Host (Optional)
If you want to switch the domain as well:
```bash
# Rename /etc/apache2/sites-available/doxcite.conf to:
# /etc/apache2/sites-available/bot-ukidney.conf

# And change the ServerName:
<VirtualHost *:80>
    ServerName brightbean.io
    ServerAlias www.brightbean.io

    ProxyPass / http://127.0.0.1:3456/
    ProxyPassReverse / http://127.0.0.1:3456/
    # ... rest same
</VirtualHost>
```

### 5. Redeploy
```bash
# From your local machine
./deploy2.sh
```

---

## Quick Switch Commands

### To doxcite.com (3457):
```bash
# 1. Update server.js
sed -i 's/3457/3456/g' server.js

# 2. Update ecosystem.config.brightbean.js
sed -i "s/'doxcite-bot'/'manual-bot'/g" ecosystem.config.brightbean.js

# 3. Update .env on server
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 "echo 'PORT=3457' > /home/doxcite/public_html/.env"

# 4. Redeploy
./deploy2.sh
```

### To brightbean.io (3456):
```bash
# 1. Update server.js
sed -i 's/3456/3457/g' server.js

# 2. Update ecosystem.config.brightbean.js
sed -i "s/'manual-bot'/'doxcite-bot'/g" ecosystem.config.brightbean.js

# 3. Update .env on server
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 "echo 'PORT=3456' > /home/doxcite/public_html/.env"

# 4. Redeploy
./deploy2.sh
```

---

## Testing After Switch

### Check Server Status
```bash
# SSH to server and check:
pm2 list
netstat -tlnp | grep -E "(3456|3457)"
curl http://127.0.0.1:3456/api/ready  # For brightbean.io
curl http://127.0.0.1:3457/api/ready  # For doxcite.com
```

### Test External Access
```bash
# Test via IP
curl -I http://162.246.254.111:3456/  # brightbean.io
curl -I http://162.246.254.111:3457/  # doxcite.com

# Test via domain (after DNS setup)
curl -I http://brightbean.io/
curl -I http://doxcite.com/
```

---

## Apache Configuration Management

### Enable/Disable Sites
```bash
# For doxcite.com
sudo a2ensite doxcite.conf
sudo a2dissite bot-ukidney.conf
sudo systemctl reload apache2

# For brightbean.io
sudo a2ensite bot-ukidney.conf
sudo a2dissite doxcite.conf
sudo systemctl reload apache2
```

### Check Active Sites
```bash
ls -la /etc/apache2/sites-enabled/
```

---

## Troubleshooting

### Port Conflicts
```bash
# Check what's using ports
sudo netstat -tlnp | grep -E "(3456|3457)"
sudo lsof -i :3456
sudo lsof -i :3457
```

### PM2 Issues
```bash
# Check PM2 logs
pm2 logs

# Restart PM2 process
pm2 restart doxcite-bot
# or
pm2 restart manual-bot
```

### Environment Variables
```bash
# Check current environment
echo $PORT
cat /home/doxcite/public_html/.env
```

---

## Important Notes

1. **DNS Propagation**: Domain changes take 24-48 hours to propagate globally
2. **Backup**: Always backup configurations before switching
3. **Testing**: Test both configurations before switching in production
4. **Apache Reload**: Don't forget to reload Apache after virtual host changes
5. **PM2 Process**: Make sure the old process is stopped before starting the new one

## Current Status
- ✅ **doxcite.com**: Port 3457, PM2: `doxcite-bot`
- ✅ **brightbean.io**: Port 3456, PM2: `manual-bot`

Both can run simultaneously if you have different PM2 process names and ports.
