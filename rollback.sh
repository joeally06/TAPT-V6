#!/bin/bash
# TAPT-V6 Rollback Script
# Run as: ./rollback.sh [commit-hash or branch]
# Example: ./rollback.sh HEAD~1  (rollback 1 commit)
# Example: ./rollback.sh abc123  (rollback to specific commit)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_error() { echo -e "${RED}✗ $1${NC}"; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }

TARGET=${1:-HEAD~1}

echo "========================================="
echo "    TAPT-V6 Rollback"
echo "========================================="
echo ""

print_warning "Rolling back to: $TARGET"
echo ""
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    print_error "Rollback cancelled"
    exit 1
fi

cd /var/www/tapt || { print_error "/var/www/tapt not found"; exit 1; }

# Create backup of current state
BACKUP_BRANCH="backup-$(date +%Y%m%d-%H%M%S)"
git branch $BACKUP_BRANCH
print_success "Created backup branch: $BACKUP_BRANCH"

# Perform rollback
git reset --hard $TARGET
print_success "Git reset to $TARGET"

# Reinstall dependencies
npm install
print_success "Dependencies reinstalled"

# Rebuild
npm run build
print_success "Application rebuilt"

# Restart PM2
pm2 restart tapt-app
print_success "Application restarted"

echo ""
echo "========================================="
echo "✅ Rollback Complete!"
echo "========================================="
echo ""
echo "Current commit: $(git log -1 --oneline)"
echo "Backup branch: $BACKUP_BRANCH"
echo ""
echo "To undo rollback: git checkout $BACKUP_BRANCH"
echo ""
