#!/bin/bash

# Simple Softphone Setup Script using Asterisk ARI
echo "🚀 Setting up Simple Browser Softphone with Asterisk ARI..."

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
apt install -y git build-essential nginx

# Create application directory
print_status "Setting up application directory..."
mkdir -p /opt/simple-softphone

# Copy project files from current directory to /opt/simple-softphone
print_status "Copying project files..."
cp -r * /opt/simple-softphone/ 2>/dev/null || true
cd /opt/simple-softphone

# Install dependencies
print_status "Installing application dependencies..."
npm run install-all

# Build frontend
print_status "Building frontend..."
cd frontend
npm run build
cd ..

# Create .env file
print_status "Creating environment configuration..."
cat > backend/.env << EOF
PORT=3001
ASTERISK_HOST=127.0.0.1
ARI_PORT=8088
ARI_USERNAME=asterisk
ARI_PASSWORD=asterisk
EOF

# Create logs directory
mkdir -p logs

# Setup Asterisk configurations
print_status "Configuring Asterisk..."

# Backup existing configs
cp /etc/asterisk/ari.conf /etc/asterisk/ari.conf.backup 2>/dev/null || true
cp /etc/asterisk/extensions.conf /etc/asterisk/extensions.conf.backup 2>/dev/null || true
cp /etc/asterisk/http.conf /etc/asterisk/http.conf.backup 2>/dev/null || true
cp /etc/asterisk/pjsip.conf /etc/asterisk/pjsip.conf.backup 2>/dev/null || true
cp /etc/asterisk/modules.conf /etc/asterisk/modules.conf.backup 2>/dev/null || true

# Copy new configurations
cp asterisk-configs/ari.conf /etc/asterisk/
cp asterisk-configs/extensions.conf /etc/asterisk/
cp asterisk-configs/pjsip.conf /etc/asterisk/
cp asterisk-configs/modules.conf /etc/asterisk/

# Configure HTTP interface for ARI
cat > /etc/asterisk/http.conf << EOF
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8088
prefix=asterisk
enablestatic=yes
EOF

# Restart Asterisk
print_status "Restarting Asterisk..."
systemctl restart asterisk
systemctl enable asterisk

# Wait for Asterisk to start
sleep 5

# Setup Nginx
print_status "Configuring Nginx..."
cat > /etc/nginx/sites-available/simple-softphone << EOF
server {
    listen 80;
    server_name _;
    
    location / {
        root /opt/simple-softphone/frontend/build;
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
ln -sf /etc/nginx/sites-available/simple-softphone /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
systemctl enable nginx

# Setup firewall
print_status "Configuring firewall..."
ufw --force reset
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 8088/tcp  # ARI HTTP
ufw allow 5060/udp  # SIP
ufw allow 5060/tcp  # SIP
ufw --force enable

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'simple-softphone',
    script: './backend/server.js',
    cwd: '/opt/simple-softphone',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Start application with PM2
print_status "Starting application..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

print_status "✅ Setup completed successfully!"
echo ""
echo "🎉 Simple Softphone is now running!"
echo ""
echo "📋 System Information:"
echo "   - Web Interface: http://$(curl -s ifconfig.me || echo 'YOUR_SERVER_IP')"
echo "   - Backend API: http://localhost:3001"
echo "   - Asterisk ARI: http://localhost:8088/ari"
echo ""
echo "📱 How to use:"
echo "   1. Open web interface in browser"
echo "   2. Enter 'My Number' (your phone number)"
echo "   3. Enter 'Customer Number' (number to call)"
echo "   4. Click 'Dial Now' to make the call"
echo "   5. Use Hold/Resume/Hangup buttons to control call"
echo ""
echo "🧪 Testing:"
echo "   - Check ARI status: curl http://localhost:8088/ari/asterisk/info"
echo "   - Check application: curl http://localhost:3001/api/health"
echo "   - Monitor logs: pm2 logs simple-softphone"
echo ""
echo "🔧 Monitoring Commands:"
echo "   - PM2 status: pm2 status"
echo "   - Asterisk CLI: asterisk -rvv"
echo "   - Check calls: asterisk -rx 'core show channels'"
echo ""
print_status "Your simple softphone is ready to use!"