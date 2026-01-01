#!/bin/bash
# TAPT-V6 Server Status Check
# Run as: ./server-status.sh

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "========================================="
echo "    TAPT-V6 Server Status"
echo "========================================="
echo ""

# System Info
echo -e "${BLUE}📊 System Information:${NC}"
echo "  Hostname: $(hostname)"
echo "  Uptime: $(uptime -p)"
echo "  IP Address: $(hostname -I | awk '{print $1}')"
echo ""

# Node & PM2 Versions
echo -e "${BLUE}🔧 Software Versions:${NC}"
echo "  Node.js: $(node -v 2>/dev/null || echo 'Not installed')"
echo "  npm: $(npm -v 2>/dev/null || echo 'Not installed')"
echo "  PM2: $(pm2 -v 2>/dev/null || echo 'Not installed')"
echo ""

# PM2 Status
echo -e "${BLUE}⚙️  PM2 Applications:${NC}"
pm2 status
echo ""

# TAPT App Specific
echo -e "${BLUE}🚀 TAPT Application:${NC}"
if pm2 info tapt-app &>/dev/null; then
    pm2 info tapt-app | grep -E "status|uptime|memory|cpu"
else
    echo -e "${RED}  App not found in PM2${NC}"
fi
echo ""

# Port Check
echo -e "${BLUE}🌐 Port Status:${NC}"
if netstat -tuln | grep -q ":5173 "; then
    echo -e "${GREEN}  ✓ Port 5173: LISTENING${NC}"
else
    echo -e "${RED}  ✗ Port 5173: NOT LISTENING${NC}"
fi

if netstat -tuln | grep -q ":80 "; then
    echo -e "${GREEN}  ✓ Port 80: LISTENING (Nginx)${NC}"
else
    echo -e "${YELLOW}  ⚠ Port 80: NOT LISTENING${NC}"
fi
echo ""

# Nginx Status
echo -e "${BLUE}🔄 Nginx Status:${NC}"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}  ✓ Nginx is running${NC}"
else
    echo -e "${RED}  ✗ Nginx is not running${NC}"
fi
echo ""

# Disk Usage
echo -e "${BLUE}💾 Disk Usage:${NC}"
df -h /var/www/tapt 2>/dev/null | grep -v Filesystem
echo ""

# Memory Usage
echo -e "${BLUE}🧠 Memory Usage:${NC}"
free -h | grep -E "Mem|Swap"
echo ""

# Recent Logs
echo -e "${BLUE}📝 Recent Logs (last 10 lines):${NC}"
pm2 logs tapt-app --nostream --lines 10 2>/dev/null || echo "  No logs available"
echo ""

# Git Status
echo -e "${BLUE}📦 Repository Status:${NC}"
cd /var/www/tapt 2>/dev/null && {
    echo "  Branch: $(git branch --show-current)"
    echo "  Commit: $(git log -1 --oneline)"
    echo "  Status: $(git status --short | wc -l) modified files"
} || echo "  Repository not found"
echo ""

echo "========================================="
echo "Run 'pm2 logs tapt-app' for live logs"
echo "Run 'pm2 monit' for real-time monitoring"
echo "========================================="
