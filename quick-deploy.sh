#!/bin/bash
# TAPT-V6 Quick Deployment Script
# Run as: ./quick-deploy.sh (no sudo needed)

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_info() { echo -e "${BLUE}→ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }

echo "========================================="
echo "    TAPT-V6 Quick Deployment"
echo "========================================="
echo ""

# Navigate to app directory
cd /var/www/tapt || { echo "Error: /var/www/tapt not found"; exit 1; }

# Stash any local changes
print_info "Stashing local changes (if any)..."
git stash 2>/dev/null || true

# Pull latest changes
print_info "Pulling latest changes from GitHub..."
git pull origin TAPTv6
print_success "Repository updated"

# Install/update dependencies
print_info "Installing dependencies..."
npm install
print_success "Dependencies installed"

# Type check
print_info "Running type check..."
npm run type-check
print_success "Type check passed"

# Build production bundle
print_info "Building production bundle..."
npm run build
print_success "Build completed"

# Restart PM2
print_info "Restarting application..."
pm2 restart tapt-app --update-env
print_success "Application restarted"

# Wait a moment for app to start
sleep 2

# Show status
echo ""
echo "========================================="
echo "✅ Deployment Complete!"
echo "========================================="
echo ""
pm2 status tapt-app
echo ""
print_info "View logs with: pm2 logs tapt-app"
print_info "Monitor with: pm2 monit"
echo ""
