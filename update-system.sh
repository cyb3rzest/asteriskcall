#!/bin/bash

# Update script for 10-digit phone number support
# Run this on your server to update the system

set -e

echo "🔄 Updating Asterisk Call Management System for 10-digit phone numbers..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
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

# Stop the application
print_status "Stopping application..."
pm2 stop asterisk-call-backend || true

# Update backend code
print_status "Updating backend..."
# The backend/server.js should already be updated with your changes

# Update frontend
print_status "Updating frontend..."
cd frontend
npm run build
cd ..

# Update Asterisk configuration
print_status "Updating Asterisk configuration..."
cp /etc/asterisk/extensions.conf /etc/asterisk/extensions.conf.backup.$(date +%Y%m%d_%H%M%S)
cp asterisk-configs/extensions.conf /etc/asterisk/

# Reload Asterisk configuration
print_status "Reloading Asterisk configuration..."
asterisk -rx "dialplan reload"

# Restart application
print_status "Starting application..."
pm2 start asterisk-call-backend

# Reload nginx
print_status "Reloading Nginx..."
systemctl reload nginx

print_status "✅ Update completed successfully!"
echo ""
echo "🎉 System now supports 10-digit phone numbers!"
echo ""
echo "📋 Changes made:"
echo "   - Frontend now accepts 10-digit phone numbers"
echo "   - Added phone number validation"
echo "   - Updated Asterisk dialplan for outbound calls"
echo "   - Improved user interface with digit counters"
echo ""
echo "🔧 How to use:"
echo "   1. Enter your 10-digit phone number in 'Self Number'"
echo "   2. Enter customer's 10-digit phone number in 'Customer Number'"
echo "   3. Click 'Dial Now' to initiate the call"
echo ""
echo "⚠️  Important:"
echo "   - You need to configure your SIP trunk provider in extensions.conf"
echo "   - Replace 'your-sip-provider' with your actual provider details"
echo "   - For testing, you can still use 6001, 6002 extensions"
echo ""
print_warning "Don't forget to configure your SIP trunk provider for real phone calls!"