# Custom Domain Setup Guide

**Date:** January 24, 2025  
**Version:** 1.0

## Overview

This guide explains how to configure custom domain names (CNAMEs) for document owners, allowing them to use branded domains like `nephrology.ukidney.com` instead of the default `?owner=ukidney` parameter.

## How It Works

When a user visits a custom domain configured for an owner, the application automatically detects the hostname and routes the request as if the user had visited with the `?owner=` parameter.

**Example:**
- Custom domain: `nephrology.ukidney.com`
- Owner: `ukidney`
- Visiting `https://nephrology.ukidney.com/chat` is equivalent to `https://yoursite.com/chat?owner=ukidney`

## Configuration Steps

### For System Administrators

#### 1. Set Custom Domain in Database

Connect to your Supabase database and update the owner record:

```sql
UPDATE owners 
SET custom_domain = 'nephrology.ukidney.com' 
WHERE slug = 'ukidney';
```

Verify the configuration:

```sql
SELECT slug, name, custom_domain 
FROM owners 
WHERE custom_domain IS NOT NULL;
```

#### 2. Verify Database Migration

Ensure the migration has been applied:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'owners' 
AND column_name = 'custom_domain';
```

#### 3. Clear Application Cache

After updating the database, you may need to wait up to 2 minutes for the cache to refresh automatically, or restart the server to force an immediate refresh.

### For Domain Owners

#### 1. DNS Configuration

Add a CNAME record pointing your custom domain to your application's main domain:

**Example DNS Configuration:**

```
Type: CNAME
Name: nephrology
Value: your-app-domain.com
TTL: 3600 (or your preference)
```

**Important Notes:**
- Use the base domain of your application (the domain that serves the app)
- The CNAME target should point to the same server that runs the application
- Do not include `http://` or `https://` in the CNAME value

#### 2. SSL/TLS Configuration

Ensure your web server (nginx, Apache, etc.) can handle SSL certificates for custom domains:

**For nginx with Certbot:**

```nginx
server {
    listen 443 ssl http2;
    server_name nephrology.ukidney.com;

    ssl_certificate /etc/letsencrypt/live/nephrology.ukidney.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nephrology.ukidney.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3456;  # Your app's internal port
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name nephrology.ukidney.com;
    return 301 https://$server_name$request_uri;
}
```

**Obtain SSL Certificate:**

```bash
sudo certbot --nginx -d nephrology.ukidney.com
```

#### 3. Verification

After DNS propagation (usually within 1-24 hours):

1. Visit your custom domain: `https://nephrology.ukidney.com/chat`
2. Verify the page loads correctly
3. Check that the owner's documents are displayed
4. Verify the owner logo/branding appears

## Domain Validation

The application expects domains in the following format:

```
subdomain.example.com
```

- Must be a valid FQDN (Fully Qualified Domain Name)
- No protocol prefix (`http://` or `https://`)
- No path or query parameters
- Case-insensitive (will be lowercased automatically)

## Troubleshooting

### Issue: Domain Not Routing to Owner

**Symptoms:**
- Visiting custom domain shows default page or error
- Not redirecting to owner's documents

**Solutions:**
1. Check database configuration:
   ```sql
   SELECT slug, custom_domain FROM owners WHERE slug = 'ukidney';
   ```
2. Verify DNS propagation (use `dig` or online DNS checker):
   ```bash
   dig nephrology.ukidney.com
   ```
3. Check server logs for hostname detection:
   ```bash
   # Look for log message: "Custom domain detected: ..."
   tail -f server.log
   ```
4. Restart the server to refresh cache:
   ```bash
   pm2 restart all
   ```

### Issue: SSL Certificate Errors

**Symptoms:**
- Browser shows "Not Secure" warning
- SSL certificate mismatch errors

**Solutions:**
1. Verify certificate covers the custom domain:
   ```bash
   openssl s_client -connect nephrology.ukidney.com:443 -servername nephrology.ukidney.com
   ```
2. Renew certificate if expired:
   ```bash
   sudo certbot renew
   ```
3. Ensure SNI is configured correctly in nginx/Apache

### Issue: Multiple Owners with Same Domain

**Symptoms:**
- Database error when trying to set custom_domain
- "duplicate key value" error

**Cause:**
The `custom_domain` column has a UNIQUE constraint - each domain can only be assigned to one owner.

**Solution:**
Remove the custom_domain from the current owner first:
```sql
UPDATE owners SET custom_domain = NULL WHERE slug = 'old-owner';
```

### Issue: Cache Not Updating

**Symptoms:**
- Domain changes not taking effect
- Still using old domain mapping

**Solutions:**
1. Wait 2 minutes for automatic cache refresh
2. Restart the server:
   ```bash
   pm2 restart all
   ```
3. Check cache timestamp in logs on startup

## Security Considerations

### 1. DNS Validation

**Recommendation:** Consider implementing DNS validation to verify ownership before allowing custom domains. This prevents unauthorized domain claims.

### 2. Rate Limiting

Ensure your application has proper rate limiting to prevent abuse via custom domains.

### 3. SSL/TLS Requirements

**Requirement:** Always use HTTPS for custom domains. HTTP traffic should be redirected to HTTPS.

### 4. Access Control

Custom domains follow the same access control rules as regular owner pages:
- Public documents are accessible without authentication
- Private documents require authentication
- Owner permissions apply normally

## Maintenance

### Regular Tasks

1. **Monitor SSL Expiration:**
   ```bash
   certbot certificates
   ```

2. **Verify DNS Resolution:**
   ```bash
   dig +short nephrology.ukidney.com
   ```

3. **Check Database Health:**
   ```sql
   SELECT COUNT(*) as active_custom_domains 
   FROM owners 
   WHERE custom_domain IS NOT NULL;
   ```

### Removing Custom Domains

To remove a custom domain:

```sql
UPDATE owners 
SET custom_domain = NULL 
WHERE slug = 'ukidney';
```

Wait for cache refresh (2 minutes) or restart the server.

## Example Configurations

### UKidney Medical

```sql
UPDATE owners 
SET custom_domain = 'nephrology.ukidney.com' 
WHERE slug = 'ukidney';
```

**DNS:**
```
Type: CNAME
Name: nephrology
Value: manuals.ukidney.com
TTL: 3600
```

### Maker Pizza

```sql
UPDATE owners 
SET custom_domain = 'training.makerpizza.com' 
WHERE slug = 'maker-pizza';
```

**DNS:**
```
Type: CNAME
Name: training
Value: app.example.com
TTL: 3600
```

## Support

For issues or questions:
1. Check server logs in `server.log`
2. Verify database configuration
3. Test DNS resolution
4. Contact system administrator

## See Also

- [Owner-Based Chunk Limits](./OWNER-BASED-CHUNK-LIMITS.md)
- [Document Selector Feature](./DOCUMENT-SELECTOR-FEATURE.md)
- [Admin Dashboard Guide](./ADMIN-CRUD-GUIDE.md)
