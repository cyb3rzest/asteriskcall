#!/bin/bash

# WebRTC Setup Script for Asterisk Call Management System
echo "🌐 Setting up WebRTC support for browser-based calling..."

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

print_status "Installing WebRTC dependencies..."

# Install required packages for WebRTC
apt update
apt install -y openssl

# Create SSL certificates for WebRTC (self-signed for testing)
print_status "Creating SSL certificates for WebRTC..."
mkdir -p /etc/asterisk/keys

# Generate self-signed certificate
openssl req -new -x509 -days 365 -nodes -out /etc/asterisk/keys/asterisk.crt -keyout /etc/asterisk/keys/asterisk.key -subj "/C=US/ST=State/L=City/O=Organization/CN=46.62.157.243"

# Set proper permissions
chown asterisk:asterisk /etc/asterisk/keys/asterisk.*
chmod 600 /etc/asterisk/keys/asterisk.*

# Update Asterisk configurations
print_status "Updating Asterisk configurations for WebRTC..."

# Backup existing configs
cp /etc/asterisk/http.conf /etc/asterisk/http.conf.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# Copy new configurations
cp asterisk-configs/http.conf /etc/asterisk/
cp asterisk-configs/pjsip.conf /etc/asterisk/

# Update modules.conf to load required modules
print_status "Updating modules configuration..."
cat >> /etc/asterisk/modules.conf << 'EOF'

; WebRTC modules
load => res_http_websocket.so
load => res_pjsip_transport_websocket.so
load => codec_opus.so
EOF

# Update frontend to include WebRTC dependencies
print_status "Installing frontend WebRTC dependencies..."
cd frontend
npm install --save jssip
npm run build
cd ..

# Update backend for WebRTC support
print_status "Updating backend for WebRTC support..."
cd backend
npm install --save ws
cd ..

# Restart services
print_status "Restarting services..."
systemctl restart asterisk
sleep 3

# Restart application
pm2 restart asterisk-call-backend

# Reload nginx
systemctl reload nginx

# Update firewall for WebRTC
print_status "Updating firewall for WebRTC..."
ufw allow 8088/tcp  # HTTP interface
ufw allow 8089/tcp  # WebSocket
ufw allow 8090/tcp  # Secure WebSocket
ufw allow 10000:20000/udp  # RTP range for WebRTC

print_status "✅ WebRTC setup completed!"
echo ""
echo "🌐 WebRTC Configuration Summary:"
echo "   - HTTP Interface: http://46.62.157.243:8088"
echo "   - WebSocket: ws://46.62.157.243:8089"
echo "   - SSL Certificates: Self-signed (created)"
echo "   - WebRTC Extensions: webrtc-user1, webrtc-user2"
echo ""
echo "🔧 WebRTC Credentials:"
echo "   - Username: webrtc-user1"
echo "   - Password: webrtc123"
echo "   - SIP URI: webrtc-user1@46.62.157.243"
echo ""
echo "📱 How to use:"
echo "   1. Access web interface: http://46.62.157.243"
echo "   2. Go to WebRTC Phone section"
echo "   3. Register with webrtc-user1@46.62.157.243"
echo "   4. Make calls directly from browser!"
echo ""
echo "🧪 Testing:"
echo "   - Check Asterisk WebRTC: asterisk -rx 'http show status'"
echo "   - Check WebSocket: asterisk -rx 'pjsip show transports'"
echo "   - Test WebRTC endpoint: asterisk -rx 'pjsip show endpoints'"
echo ""
print_warning "Allow microphone access in your browser when prompted!"
print_status "WebRTC is now ready for browser-based calling!"