# Reverse Proxy Configuration Guide

This guide explains how to configure OwnRSVP behind a reverse proxy, including nginx proxy manager, nginx, Apache, and Caddy.

## Overview

When running OwnRSVP behind a reverse proxy, you need to:

1. Configure the reverse proxy to forward proper headers
2. Set the correct environment variables in OwnRSVP
3. Ensure SSL/TLS termination is handled correctly

## Environment Variables

**Required when behind a reverse proxy:**

```env
# Your public domain (what users see in their browser)
AUTH_URL="https://yourdomain.com"
NEXT_PUBLIC_APP_URL="https://yourdomain.com"

# Trust the proxy host (required)
AUTH_TRUST_HOST="true"
```

**Important:** 
- Use `https://` if your reverse proxy terminates SSL
- Use the public domain, not `localhost` or internal IPs
- Both `AUTH_URL` and `NEXT_PUBLIC_APP_URL` should match your public domain

## nginx Proxy Manager

### Step 1: Add Proxy Host

1. Log into nginx proxy manager
2. Go to **Proxy Hosts** → **Add Proxy Host**
3. Configure:
   - **Domain Names**: `yourdomain.com` (and `www.yourdomain.com` if needed)
   - **Scheme**: `http`
   - **Forward Hostname/IP**: `your-app-container-name` or `localhost`
   - **Forward Port**: `3000`
   - **Forward Scheme**: `http`
   - **Cache Assets**: Enabled (optional)
   - **Block Common Exploits**: Enabled (recommended)
   - **Websockets Support**: Enabled (if using real-time features)

### Step 2: SSL Certificate

1. Go to **SSL Certificates** tab
2. Request a new SSL certificate (Let's Encrypt recommended)
3. Enable **Force SSL** and **HTTP/2 Support**

### Step 3: Advanced Configuration

Add these custom headers in the **Advanced** tab:

```nginx
# Forward real client IP
proxy_set_header X-Real-IP $remote_addr;

# Forward original protocol
proxy_set_header X-Forwarded-Proto $scheme;

# Forward original host
proxy_set_header X-Forwarded-Host $host;

# Forward original port
proxy_set_header X-Forwarded-Port $server_port;

# Forward client IP through proxy chain
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

### Step 4: Health Check (Optional)

Configure a health check to monitor the app:

- **Health Check Path**: `/api/health`
- **Health Check Interval**: 30 seconds

## Direct nginx Configuration

If you're configuring nginx directly, use this configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Proxy Settings
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # Required headers for Next.js and NextAuth
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # WebSocket support (if needed)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://localhost:3000/api/health;
        access_log off;
    }
}
```

## Apache Configuration

For Apache, enable required modules and use this configuration:

```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    ServerAlias www.yourdomain.com
    
    # Redirect to HTTPS
    Redirect permanent / https://yourdomain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName yourdomain.com
    ServerAlias www.yourdomain.com

    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /path/to/certificate.crt
    SSLCertificateKeyFile /path/to/private.key

    # Proxy Settings
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    # Required headers
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port "443"
    RequestHeader set X-Real-IP %{REMOTE_ADDR}s
</VirtualHost>
```

## Caddy Configuration

Caddy automatically handles SSL and proxy headers. Simple configuration:

```
yourdomain.com {
    reverse_proxy localhost:3000 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
    }
}
```

## Docker Setup with Reverse Proxy

### Option 1: Same Docker Network

If your reverse proxy is in Docker:

1. Create a Docker network:
```bash
docker network create proxy-network
```

2. Update `docker-compose.yml`:
```yaml
services:
  app:
    networks:
      - proxy-network
      - default
    # ... rest of config

networks:
  proxy-network:
    external: true
```

3. Connect nginx proxy manager to the same network:
```bash
docker network connect proxy-network nginx-proxy-manager
```

4. In nginx proxy manager, use the container name as the forward hostname.

### Option 2: Host Network

If running on the host machine:

- Use `host.docker.internal` (Mac/Windows) or `172.17.0.1` (Linux) as forward hostname
- Or use `localhost` if nginx proxy manager is on the host

## Common Issues and Solutions

### Issue: Authentication redirects to localhost

**Solution:** Ensure `AUTH_URL` and `NEXT_PUBLIC_APP_URL` are set to your public domain with `https://`.

### Issue: Email links use http:// instead of https://

**Solution:** 
1. Set `AUTH_URL="https://yourdomain.com"` (with https)
2. Ensure your reverse proxy sets `X-Forwarded-Proto: https` header

### Issue: 404 errors on API routes

**Solution:** Ensure the reverse proxy forwards all paths (`/` and `/*`) to the app, not just the root.

### Issue: WebSocket connections fail

**Solution:** Enable WebSocket support in your reverse proxy configuration.

### Issue: Health check fails

**Solution:** The health check endpoint is at `/api/health`. Ensure your reverse proxy forwards this path.

## Testing Your Configuration

1. **Check Health Endpoint:**
   ```bash
   curl https://yourdomain.com/api/health
   ```
   Should return: `{"status":"ok","timestamp":"...","service":"OwnRSVP"}`

2. **Check Headers:**
   ```bash
   curl -I https://yourdomain.com
   ```
   Verify the response includes proper headers.

3. **Test Authentication:**
   - Try logging in through the public domain
   - Check that redirects use the public domain, not localhost

4. **Test Email Links:**
   - Send a test invitation
   - Verify the email link uses your public domain

## Security Considerations

1. **Always use HTTPS** when exposing to the internet
2. **Set proper CORS headers** if needed
3. **Rate limiting** - Consider adding rate limiting at the reverse proxy level
4. **Firewall** - Only expose ports 80/443, not port 3000 directly
5. **Keep certificates updated** - Use Let's Encrypt with auto-renewal

## Additional Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [NextAuth.js Deployment Guide](https://next-auth.js.org/deployment)
- [nginx Proxy Manager Documentation](https://nginxproxymanager.com/guide/)

