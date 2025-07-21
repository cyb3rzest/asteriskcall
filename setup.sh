#!/bin/bash

# Asterisk Call Management System Setup Script
# Run this script as root on Ubuntu 24

set -e

echo "🚀 Starting Asterisk Call Management System Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Update system
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install Node.js
print_status "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2
print_status "Installing PM2..."
npm install -g pm2

# Install additional dependencies
print_status "Installing additional dependencies..."
apt install -y git build-essential python3-dev nginx

# Create application directory
print_status "Setting up application directory..."
mkdir -p /opt/asterisk-call-system
cd /opt/asterisk-call-system

# Install dependencies
print_status "Installing application dependencies..."
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
npm run build
cd ..

# Create .env file
print_status "Creating environment configuration..."
cat > backend/.env << EOF
PORT=3001
ASTERISK_HOST=127.0.0.1
ASTERISK_PORT=5038
ASTERISK_USERNAME=admin
ASTERISK_PASSWORD=CallSystem2024!
RECORDING_PATH=/var/spool/asterisk/monitor
EOF

# Create logs directory
mkdir -p logs

# Setup Asterisk configurations
print_status "Configuring Asterisk..."

# Backup existing configs
cp /etc/asterisk/pjsip.conf /etc/asterisk/pjsip.conf.backup 2>/dev/null || true
cp /etc/asterisk/extensions.conf /etc/asterisk/extensions.conf.backup 2>/dev/null || true
cp /etc/asterisk/manager.conf /etc/asterisk/manager.conf.backup 2>/dev/null || true

# Copy new configurations
cp asterisk-configs/pjsip.conf /etc/asterisk/
cp asterisk-configs/extensions.conf /etc/asterisk/

# Configure manager interface
cat > /etc/asterisk/manager.conf << EOF
[general]
enabled = yes
port = 5038
bindaddr = 127.0.0.1
webenabled = yes

[admin]
secret = CallSystem2024!
permit = 127.0.0.1/255.255.255.0
read = all
write = all
EOF

# Create recording directory
mkdir -p /var/spool/asterisk/monitor
chown root:root /var/spool/asterisk/monitor
chmod 755 /var/spool/asterisk/monitor

# Restart Asterisk
print_status "Restarting Asterisk..."
systemctl restart asterisk
systemctl enable asterisk

# Setup Nginx
print_status "Configuring Nginx..."
cat > /etc/nginx/sites-available/asterisk-call << EOF
server {
    listen 80;
    server_name _;
    
    location / {
        root /opt/asterisk-call-system/frontend/build;
        try_files \$uri \$uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
    }
}
EOF

# Enable nginx site
ln -sf /etc/nginx/sites-available/asterisk-call /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
systemctl enable nginx

# Setup firewall
print_status "Configuring firewall..."
ufw --force reset
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 5060/udp
ufw allow 5060/tcp
ufw --force enable

# Start application with PM2
print_status "Starting application..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

print_status "Setup completed successfully!"
echo ""
echo "🎉 Asterisk Call Management System is now running!"
echo ""
echo "📋 System Information:"
echo "   - Web Interface: http://$(curl -s ifconfig.me || echo 'YOUR_SERVER_IP')"
echo "   - Backend API: http://localhost:3001"
echo "   - Asterisk Manager: localhost:5038"
echo ""
echo "🔧 Default Extensions:"
echo "   - Extension 6001: Password 'secure123'"
echo "   - Extension 6002: Password 'secure123'"
echo ""
echo "📊 Monitoring Commands:"
echo "   - Check PM2 status: pm2 status"
echo "   - Check application logs: pm2 logs asterisk-call-backend"
echo "   - Check Asterisk status: asterisk -rx 'core show version'"
echo "   - Check active calls: asterisk -rx 'core show channels'"
echo ""
echo "🔍 Troubleshooting:"
echo "   - Asterisk logs: tail -f /var/log/asterisk/full"
echo "   - Nginx logs: tail -f /var/log/nginx/error.log"
echo "   - System logs: journalctl -u asterisk -f"
echo ""
print_warning "Please test the system by accessing the web interface and making a test call!"