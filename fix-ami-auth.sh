#!/bin/bash

# Fix AMI Authentication Issue
echo "🔧 Fixing Asterisk Manager Interface Authentication..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run this script as root"
    exit 1
fi

# Navigate to application directory
cd /opt/asterisk-call-system

# Stop the backend
print_status "Stopping backend application..."
pm2 stop asterisk-call-backend || true

# Create correct .env file
print_status "Creating correct .env file with matching AMI credentials..."
cat > backend/.env << EOF
PORT=3001
ASTERISK_HOST=127.0.0.1
ASTERISK_PORT=5038
ASTERISK_USERNAME=admin
ASTERISK_PASSWORD=CallSystem2024!
RECORDING_PATH=/var/spool/asterisk/monitor
EOF

# Restart Asterisk to clear any connection issues
print_status "Restarting Asterisk to clear connections..."
systemctl restart asterisk

# Wait for Asterisk to fully start
print_status "Waiting for Asterisk to start..."
sleep 5

# Start the backend
print_status "Starting backend application..."
pm2 start asterisk-call-backend

# Check PM2 status
print_status "Checking application status..."
pm2 status

print_status "✅ AMI Authentication fixed!"
echo ""
echo "🔍 Verification:"
echo "   - Check backend logs: pm2 logs asterisk-call-backend"
echo "   - Check AMI connection: tail -f /var/log/asterisk/full"
echo "   - Test web interface: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
echo ""
print_status "The authentication issue should now be resolved!"