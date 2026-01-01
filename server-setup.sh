#!/bin/bash
# TAPT-V6 Server Setup and Deployment Script
# For existing server with Nginx already configured on port 3000
# Run as: sudo ./server-setup.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${BLUE}→ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }

echo "========================================="
echo "    TAPT-V6 Server Setup Script"
echo "========================================="
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

# Get the actual user (not root when using sudo)
ACTUAL_USER=${SUDO_USER:-$USER}
USER_HOME=$(eval echo ~$ACTUAL_USER)

print_info "Setting up for user: $ACTUAL_USER"
print_info "User home directory: $USER_HOME"
echo ""

# ==========================================
# CONFIGURATION
# ==========================================
APP_DIR="/var/www/tapt"
APP_PORT="5173"
APP_NAME="tapt-app"

# ==========================================
# 1. SYSTEM UPDATE
# ==========================================
print_info "Step 1/12: Updating system packages..."
apt update -qq && apt upgrade -y -qq
print_success "System updated"

# ==========================================
# 2. INSTALL ESSENTIAL TOOLS
# ==========================================
print_info "Step 2/12: Installing essential tools..."
apt install -y -qq curl wget git build-essential
print_success "Essential tools installed"

# ==========================================
# 3. INSTALL NODE.JS 20.x LTS
# ==========================================
print_info "Step 3/12: Installing Node.js 20.x LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y -qq nodejs
    print_success "Node.js $(node -v) installed"
else
    NODE_VERSION=$(node -v)
    print_success "Node.js already installed: $NODE_VERSION"
fi

# ==========================================
# 4. INSTALL PM2 GLOBALLY
# ==========================================
print_info "Step 4/12: Installing PM2 process manager..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 --silent
    print_success "PM2 $(pm2 -v) installed"
else
    PM2_VERSION=$(pm2 -v)
    print_success "PM2 already installed: $PM2_VERSION"
fi

# ==========================================
# 5. INSTALL SERVE (STATIC FILE SERVER)
# ==========================================
print_info "Step 5/12: Installing serve package..."
npm install -g serve --silent
print_success "serve installed"

# ==========================================
# 6. CREATE APPLICATION DIRECTORY
# ==========================================
print_info "Step 6/12: Setting up application directory..."
if [ ! -d "$APP_DIR" ]; then
    mkdir -p $APP_DIR
    print_success "Application directory created: $APP_DIR"
else
    print_success "Application directory exists: $APP_DIR"
fi
chown -R $ACTUAL_USER:$ACTUAL_USER $APP_DIR

# ==========================================
# 7. CLONE OR UPDATE REPOSITORY
# ==========================================
print_info "Step 7/12: Setting up repository..."
cd $APP_DIR

if [ -d ".git" ]; then
    print_info "Repository exists, pulling latest changes..."
    sudo -u $ACTUAL_USER git fetch origin
    sudo -u $ACTUAL_USER git pull origin TAPTv6
    print_success "Repository updated"
else
    print_info "Cloning repository..."
    sudo -u $ACTUAL_USER git clone https://github.com/joeally06/TAPT-V6.git .
    print_success "Repository cloned"
fi

# ==========================================
# 8. INSTALL NPM DEPENDENCIES
# ==========================================
print_info "Step 8/12: Installing npm dependencies..."
cd $APP_DIR
sudo -u $ACTUAL_USER npm install --production=false
print_success "Dependencies installed"

# ==========================================
# 9. CREATE OR UPDATE .ENV FILE
# ==========================================
print_info "Step 9/12: Checking environment configuration..."
if [ ! -f "$APP_DIR/.env" ]; then
    print_warning ".env file not found, creating template..."
    cat > $APP_DIR/.env << 'EOF'
# Frontend Environment Variables
# These variables are exposed to the client and must be prefixed with VITE_

# Supabase Configuration
VITE_SUPABASE_URL=https://tjxnjhjkxldhupitkvqk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqeG5qaGpreGxkaHVwaXRrdnFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0MDc3OTIsImV4cCI6MjA1MDk4Mzc5Mn0.ZpJT3tFFHfzrYj9EwEVIpz6z-M0kqIpTIEH5h5zmpHo

# Cloudflare Turnstile Site Key (Public)
VITE_TURNSTILE_SITE_KEY=0x4AAAAAABkM3_N9Cr9SJhxe

# Environment
VITE_ENV=production
EOF
    chown $ACTUAL_USER:$ACTUAL_USER $APP_DIR/.env
    print_warning ".env created - UPDATE WITH YOUR PRODUCTION CREDENTIALS!"
else
    print_success ".env file exists"
fi

# ==========================================
# 10. BUILD PRODUCTION BUNDLE
# ==========================================
print_info "Step 10/12: Building production bundle..."
cd $APP_DIR
sudo -u $ACTUAL_USER npm run build
print_success "Production build completed in ./dist"

# ==========================================
# 11. CREATE PM2 ECOSYSTEM FILE
# ==========================================
print_info "Step 11/12: Creating PM2 configuration..."
cat > $APP_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '${APP_NAME}',
    script: 'npx',
    args: 'serve -s dist -l ${APP_PORT}',
    cwd: '${APP_DIR}',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: ${APP_PORT}
    },
    error_file: '/var/log/pm2/${APP_NAME}-error.log',
    out_file: '/var/log/pm2/${APP_NAME}-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10,
    kill_timeout: 5000
  }]
};
EOF
chown $ACTUAL_USER:$ACTUAL_USER $APP_DIR/ecosystem.config.js
print_success "PM2 ecosystem file created"

# ==========================================
# 12. CREATE LOG DIRECTORY
# ==========================================
print_info "Creating log directories..."
mkdir -p /var/log/pm2
chown -R $ACTUAL_USER:$ACTUAL_USER /var/log/pm2
print_success "Log directories ready"

# ==========================================
# 13. STOP EXISTING PM2 PROCESSES
# ==========================================
print_info "Stopping any existing PM2 processes..."
sudo -u $ACTUAL_USER pm2 stop $APP_NAME 2>/dev/null || true
sudo -u $ACTUAL_USER pm2 delete $APP_NAME 2>/dev/null || true
print_success "Cleaned up existing processes"

# ==========================================
# 14. START APPLICATION WITH PM2
# ==========================================
print_info "Starting application with PM2..."
cd $APP_DIR
sudo -u $ACTUAL_USER pm2 start ecosystem.config.js
sudo -u $ACTUAL_USER pm2 save
print_success "Application started on port $APP_PORT"

# ==========================================
# 15. SETUP PM2 STARTUP SCRIPT
# ==========================================
print_info "Configuring PM2 to start on boot..."

# Remove any existing startup configuration
sudo -u $ACTUAL_USER pm2 unstartup systemd -u $ACTUAL_USER --hp $USER_HOME 2>/dev/null || true

# Generate new startup script
env PATH=$PATH:/usr/bin pm2 startup systemd -u $ACTUAL_USER --hp $USER_HOME
sudo -u $ACTUAL_USER pm2 save
print_success "PM2 will auto-start on reboot"

# ==========================================
# 16. CREATE DEPLOYMENT SCRIPT
# ==========================================
print_info "Creating deployment script..."
cat > $APP_DIR/deploy.sh << 'DEPLOY_EOF'
#!/bin/bash
# TAPT-V6 Quick Deployment Script

set -e

echo "🚀 Starting deployment..."

# Navigate to app directory
cd /var/www/tapt

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin TAPTv6

# Install/update dependencies
echo "📦 Installing dependencies..."
npm install

# Build production bundle
echo "🔨 Building production bundle..."
npm run build

# Restart PM2
echo "♻️  Restarting application..."
pm2 restart tapt-app

# Show status
echo "✅ Deployment complete!"
pm2 status tapt-app
DEPLOY_EOF

chmod +x $APP_DIR/deploy.sh
chown $ACTUAL_USER:$ACTUAL_USER $APP_DIR/deploy.sh
print_success "Deployment script created at $APP_DIR/deploy.sh"

# ==========================================
# 17. CREATE UPDATE SCRIPT FOR IMPROVEMENTS
# ==========================================
print_info "Creating update script for applying improvements..."
cat > $APP_DIR/update.sh << 'UPDATE_EOF'
#!/bin/bash
# TAPT-V6 Update Script - Apply improvements without full rebuild

set -e

echo "📦 Updating TAPT-V6..."

cd /var/www/tapt

# Pull latest changes
git pull origin TAPTv6

# Install any new dependencies
npm install

# Run type check
echo "🔍 Type checking..."
npm run type-check

# Build
echo "🔨 Building..."
npm run build

# Restart
echo "♻️  Restarting..."
pm2 restart tapt-app --update-env

echo "✅ Update complete!"
pm2 logs tapt-app --lines 20
UPDATE_EOF

chmod +x $APP_DIR/update.sh
chown $ACTUAL_USER:$ACTUAL_USER $APP_DIR/update.sh
print_success "Update script created"

# ==========================================
# 18. SET PROPER PERMISSIONS
# ==========================================
print_info "Setting file permissions..."
chown -R $ACTUAL_USER:$ACTUAL_USER $APP_DIR
find $APP_DIR -type d -exec chmod 755 {} \;
find $APP_DIR -type f -exec chmod 644 {} \;
chmod +x $APP_DIR/*.sh
print_success "Permissions configured"

# ==========================================
# FINAL SUMMARY
# ==========================================
echo ""
echo "========================================="
echo "✅ TAPT-V6 Setup Complete!"
echo "========================================="
echo ""
echo "📋 Installation Summary:"
echo "  • Node.js: $(node -v)"
echo "  • npm: $(npm -v)"
echo "  • PM2: $(pm2 -v)"
echo "  • Application: $APP_DIR"
echo "  • Running on: http://localhost:$APP_PORT"
echo "  • PM2 Process: $APP_NAME"
echo ""
echo "🔧 Application Status:"
sudo -u $ACTUAL_USER pm2 status
echo ""
echo "📝 Useful Commands:"
echo "  • View logs:        pm2 logs $APP_NAME"
echo "  • Restart app:      pm2 restart $APP_NAME"
echo "  • Stop app:         pm2 stop $APP_NAME"
echo "  • App status:       pm2 status"
echo "  • App info:         pm2 info $APP_NAME"
echo "  • Monitor:          pm2 monit"
echo ""
echo "🚀 Deployment:"
echo "  • Quick deploy:     cd $APP_DIR && ./deploy.sh"
echo "  • Apply updates:    cd $APP_DIR && ./update.sh"
echo ""
echo "⚠️  Important:"
echo "  • Nginx is already configured (no changes made)"
echo "  • Application serves on port $APP_PORT"
echo "  • PM2 will auto-start on reboot"
echo "  • Update .env file if needed: nano $APP_DIR/.env"
echo ""
echo "🔐 Security Checklist:"
echo "  • [ ] Configure firewall (ufw)"
echo "  • [ ] Set up SSL certificate (certbot)"
echo "  • [ ] Review .env for production values"
echo "  • [ ] Test all forms and functionality"
echo ""
echo "========================================="
echo "🎉 Server is ready for production!"
echo "========================================="
