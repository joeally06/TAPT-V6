# TAPT-V6 Production Configuration

## Server Configuration

- **Application Directory**: `/var/www/tapt`
- **Application Port**: `5173` (matches Vite dev server port)
- **Nginx Proxy**: Port 80/443 → Port 5173
- **PM2 Process Name**: `tapt-app`

## Port Configuration

The application runs on **port 5173** in production to match your nginx reverse proxy configuration.

### Nginx Configuration (Reference)

Your existing nginx should be configured to proxy to port 5173:

```nginx
server {
    listen 80;
    server_name tapt.org www.tapt.org tntapt.com www.tntapt.com;
    
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## PM2 Ecosystem Configuration

```javascript
module.exports = {
  apps: [{
    name: 'tapt-app',
    script: 'npx',
    args: 'serve -s dist -l 5173',  // Port 5173
    cwd: '/var/www/tapt',
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M'
  }]
};
```

## Deployment Process

1. **Initial Setup**: `sudo ./server-setup.sh`
2. **Regular Updates**: `./quick-deploy.sh`
3. **Check Status**: `./server-status.sh`

## Verify Configuration

After setup, verify the application is running on port 5173:

```bash
# Check port is listening
netstat -tuln | grep 5173

# Check nginx is proxying correctly
curl http://localhost:5173

# Check from outside (through nginx)
curl http://your-server-ip
```

## Environment Variables

Located in `/var/www/tapt/.env`:

```env
VITE_SUPABASE_URL=https://tjxnjhjkxldhupitkvqk.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_TURNSTILE_SITE_KEY=your_site_key
VITE_ENV=production
```

## Useful Commands

```bash
# PM2 Management
pm2 status                    # Check app status
pm2 logs tapt-app            # View logs
pm2 restart tapt-app         # Restart app
pm2 monit                    # Monitor resources

# Deployment
cd /var/www/tapt
./quick-deploy.sh            # Deploy latest changes
./rollback.sh HEAD~1         # Rollback if needed
./server-status.sh           # Check server health

# Nginx
sudo systemctl status nginx   # Check nginx status
sudo systemctl reload nginx   # Reload nginx config
sudo nginx -t                 # Test nginx config
```

## Firewall Configuration

Ensure these ports are open:

```bash
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # HTTP
sudo ufw allow 443/tcp       # HTTPS (if using SSL)
sudo ufw status
```

Note: Port 5173 should NOT be exposed externally - it's only accessed by nginx on localhost.

## Log Files

- **PM2 Logs**: `/var/log/pm2/tapt-app-out.log` and `tapt-app-error.log`
- **Nginx Logs**: `/var/log/nginx/access.log` and `error.log`

## Troubleshooting

### App not responding
```bash
pm2 restart tapt-app
pm2 logs tapt-app --lines 50
```

### Port conflict
```bash
# Check what's using port 5173
sudo lsof -i :5173
# Kill process if needed
sudo kill -9 <PID>
```

### Permission issues
```bash
sudo chown -R $USER:$USER /var/www/tapt
```

### Nginx not proxying
```bash
sudo nginx -t                 # Test config
sudo systemctl restart nginx  # Restart nginx
```
