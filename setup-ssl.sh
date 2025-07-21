#!/bin/bash

# SSL Setup Script for WebRTC Support
echo "🔒 Setting up SSL/HTTPS for WebRTC functionality..."

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

SERVER_IP="46.62.157.243"

print_status "Installing Certbot for Let's Encrypt SSL certificates..."

# Install snapd if not present
apt update
apt install -y snapd

# Install certbot via snap
snap install core; snap refresh core
snap install --classic certbot

# Create symlink
ln -sf /snap/bin/certbot /usr/bin/certbot

print_status "Generating SSL certificate for $SERVER_IP..."

# Stop nginx temporarily
systemctl stop nginx

# Generate certificate using standalone mode
certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email admin@example.com \
    --domains $SERVER_IP

# Check if certificate was generated
if [ ! -f "/etc/letsencrypt/live/$SERVER_IP/fullchain.pem" ]; then
    print_warning "Let's Encrypt failed. Creating self-signed certificate..."
    
    # Create self-signed certificate as fallback
    mkdir -p /etc/ssl/asterisk
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/ssl/asterisk/asterisk.key \
        -out /etc/ssl/asterisk/asterisk.crt \
        -subj "/C=US/ST=State/L=City/O=Asterisk/CN=$SERVER_IP"
    
    SSL_CERT="/etc/ssl/asterisk/asterisk.crt"
    SSL_KEY="/etc/ssl/asterisk/asterisk.key"
    
    print_warning "Using self-signed certificate. You'll need to accept browser security warning."
else
    SSL_CERT="/etc/letsencrypt/live/$SERVER_IP/fullchain.pem"
    SSL_KEY="/etc/letsencrypt/live/$SERVER_IP/privkey.pem"
    print_status "Let's Encrypt certificate generated successfully!"
fi

print_status "Configuring Nginx with SSL..."

# Create SSL-enabled Nginx configuration
cat > /etc/nginx/sites-available/asterisk-call-ssl << EOF
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name $SERVER_IP;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name $SERVER_IP;
    
    # SSL Configuration
    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    
    # Frontend
    location / {
        root /opt/asterisk-call-system/frontend/build;
        try_files \$uri \$uri/ /index.html;
        
        # Additional headers for WebRTC
        add_header Cross-Origin-Embedder-Policy require-corp;
        add_header Cross-Origin-Opener-Policy same-origin;
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # WebSocket for Socket.IO
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Asterisk WebSocket for WebRTC
    location /ws {
        proxy_pass http://localhost:8089;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable SSL site and disable old one
ln -sf /etc/nginx/sites-available/asterisk-call-ssl /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/asterisk-call

# Test nginx configuration
nginx -t

if [ $? -eq 0 ]; then
    print_status "Nginx configuration is valid. Starting services..."
    
    # Start nginx
    systemctl start nginx
    systemctl enable nginx
    
    # Update firewall
    ufw allow 443/tcp
    
    print_status "✅ SSL setup completed successfully!"
    echo ""
    echo "🔒 SSL Configuration Summary:"
    echo "   - HTTPS URL: https://$SERVER_IP"
    echo "   - HTTP redirects to HTTPS automatically"
    echo "   - SSL Certificate: $(basename $SSL_CERT)"
    echo "   - WebRTC now supported with SSL"
    echo ""
    echo "🌐 Access your application:"
    echo "   - Secure URL: https://$SERVER_IP"
    echo "   - WebRTC will now work properly"
    echo ""
    
    if [[ $SSL_CERT == *"ssl/asterisk"* ]]; then
        print_warning "Using self-signed certificate!"
        echo "   - You'll see a security warning in browser"
        echo "   - Click 'Advanced' → 'Proceed to $SERVER_IP (unsafe)'"
        echo "   - This is normal for self-signed certificates"
    fi
    
    echo ""
    print_status "WebRTC is now ready with SSL support!"
    
else
    print_error "Nginx configuration failed. Please check the configuration."
    exit 1
fi

# Set up automatic certificate renewal if using Let's Encrypt
if [[ $SSL_CERT == *"letsencrypt"* ]]; then
    print_status "Setting up automatic certificate renewal..."
    
    # Add renewal cron job
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
    
    print_status "Automatic certificate renewal configured!"
fi