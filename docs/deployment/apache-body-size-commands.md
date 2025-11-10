# Apache Request Body Size Limit - Commands

## Check Current Apache Configuration

### 1. Check if LimitRequestBody is set in Apache config files
```bash
# Search main Apache config
sudo grep -r "LimitRequestBody" /etc/apache2/ 2>/dev/null

# Check virtual host configs
sudo grep -r "LimitRequestBody" /etc/apache2/sites-enabled/ 2>/dev/null

# Check .htaccess in your project directory
grep -i "LimitRequestBody" /path/to/your/project/.htaccess 2>/dev/null || echo "Not found in .htaccess"
```

### 2. Check Apache version and modules
```bash
# Check Apache version
apache2 -v
# or
httpd -v

# Check if mod_reqtimeout is loaded (can affect body size)
apache2ctl -M | grep reqtimeout
# or
httpd -M | grep reqtimeout
```

### 3. Check current default limit (if not set, Apache defaults to unlimited)
```bash
# This will show if LimitRequestBody is set anywhere
sudo apache2ctl -S 2>/dev/null | grep -i limit
# or
sudo httpd -S 2>/dev/null | grep -i limit
```

## Set LimitRequestBody

### Option 1: Add to .htaccess (Recommended - Project-specific)

Add this line to your `.htaccess` file:

```apache
# Allow up to 10MB for JSON text uploads (5 million characters)
LimitRequestBody 10485760
```

**Commands to add it:**
```bash
# Navigate to your project directory
cd /path/to/your/project

# Backup current .htaccess
cp .htaccess .htaccess.backup

# Add LimitRequestBody to .htaccess (if not already present)
if ! grep -q "LimitRequestBody" .htaccess; then
    echo "" >> .htaccess
    echo "# Allow up to 10MB for JSON text uploads (5 million characters)" >> .htaccess
    echo "LimitRequestBody 10485760" >> .htaccess
    echo "✅ Added LimitRequestBody to .htaccess"
else
    echo "⚠️  LimitRequestBody already exists in .htaccess"
    grep "LimitRequestBody" .htaccess
fi
```

### Option 2: Set in Apache Virtual Host Config (Server-wide)

```bash
# Find your virtual host config file
sudo ls -la /etc/apache2/sites-enabled/
# or
sudo ls -la /etc/httpd/conf.d/

# Edit the virtual host config (replace 'your-site' with actual filename)
sudo nano /etc/apache2/sites-enabled/your-site.conf
# or
sudo nano /etc/httpd/conf.d/your-site.conf

# Add inside <VirtualHost> block:
# LimitRequestBody 10485760
```

### Option 3: Set in Main Apache Config (Global - affects all sites)

```bash
# Edit main Apache config
sudo nano /etc/apache2/apache2.conf
# or
sudo nano /etc/httpd/conf/httpd.conf

# Add:
# LimitRequestBody 10485760
```

## Size Values Reference

- **10MB** = `10485760` bytes (for 5M character text uploads)
- **50MB** = `52428800` bytes (for large PDF uploads)
- **200MB** = `209715200` bytes (maximum file upload size)
- **Unlimited** = `0` (not recommended for security)

## Test and Reload Apache

### Test Apache configuration syntax
```bash
# Test config without restarting
sudo apache2ctl configtest
# or
sudo httpd -t
```

### Reload Apache (if config test passes)
```bash
# Graceful reload (recommended - doesn't drop connections)
sudo systemctl reload apache2
# or
sudo systemctl reload httpd

# Alternative: Restart Apache
sudo systemctl restart apache2
# or
sudo systemctl restart httpd
```

### Check Apache status
```bash
sudo systemctl status apache2
# or
sudo systemctl status httpd
```

## Verify the Setting

### Check if LimitRequestBody is active
```bash
# After reloading, verify it's in the config
sudo apache2ctl -S | grep -i limit
# or check .htaccess
grep "LimitRequestBody" /path/to/your/project/.htaccess
```

### Test with curl (optional)
```bash
# Test with a large request (this will fail if limit is too low)
curl -X POST https://your-domain.com/api/upload-text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title":"test","content":"'$(python3 -c "print('x' * 1000000)")'"}'
```

## Quick One-Liner to Add to .htaccess

```bash
cd /path/to/your/project && \
if ! grep -q "LimitRequestBody" .htaccess; then \
  echo "" >> .htaccess && \
  echo "# Allow up to 10MB for JSON text uploads" >> .htaccess && \
  echo "LimitRequestBody 10485760" >> .htaccess && \
  echo "✅ Added LimitRequestBody to .htaccess"; \
else \
  echo "⚠️  LimitRequestBody already exists:"; \
  grep "LimitRequestBody" .htaccess; \
fi
```

## Troubleshooting

### If you get "413 Request Entity Too Large" after setting LimitRequestBody:

1. **Check if .htaccess is being read:**
```bash
# Ensure AllowOverride is set in Apache config
sudo grep -r "AllowOverride" /etc/apache2/sites-enabled/
# Should show: AllowOverride All (or at least Limit)
```

2. **Check Apache error logs:**
```bash
sudo tail -f /var/log/apache2/error.log
# or
sudo tail -f /var/log/httpd/error_log
```

3. **Check if mod_core is loaded (required for LimitRequestBody):**
```bash
apache2ctl -M | grep core
# Should show: core_module (shared)
```

4. **Verify the directive syntax:**
```bash
# Test Apache config
sudo apache2ctl configtest
```

## Recommended Configuration

For your use case (5 million character text uploads), add to `.htaccess`:

```apache
# Allow up to 10MB for JSON text uploads (5 million characters)
# This supports the text upload feature while preventing abuse
LimitRequestBody 10485760
```

This matches the Express.js middleware limit we set (10MB).


