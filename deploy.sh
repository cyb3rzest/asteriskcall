#!/bin/bash
echo "🚀 Manual Deploy - Simple Softphone to 46.62.157.243..."

# Navigate to project directory
cd /opt/asterisk-call-system

# Stop application
pm2 stop simple-softphone 2>/dev/null || true
pm2 stop asterisk-call-backend 2>/dev/null || true

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm run install-all

# Build frontend
echo "🏗️ Building frontend..."
cd frontend && npm run build && cd ..

# Copy Asterisk configurations
echo "⚙️ Updating Asterisk configurations..."
sudo cp asterisk-configs/ari.conf /etc/asterisk/
sudo cp asterisk-configs/extensions.conf /etc/asterisk/
sudo cp asterisk-configs/pjsip.conf /etc/asterisk/
sudo cp asterisk-configs/modules.conf /etc/asterisk/

# Configure Asterisk HTTP
echo "🌐 Configuring Asterisk HTTP..."
sudo tee /etc/asterisk/http.conf << 'EOF'
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8088
prefix=asterisk
enablestatic=yes
EOF

# Create environment file
echo "🔧 Creating environment configuration..."
cat > backend/.env << 'EOF'
PORT=3001
ASTERISK_HOST=127.0.0.1
ARI_PORT=8088
ARI_USERNAME=softphone
ARI_PASSWORD=softphone123
EOF

# Restart Asterisk
echo "🔄 Restarting Asterisk..."
sudo systemctl restart asterisk
sleep 10

# Setup Nginx
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/simple-softphone << 'EOF'
server {
    listen 80;
    server_name 46.62.157.243;
    
    location / {
        root /opt/asterisk-call-system/frontend/build;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
EOF

# Enable nginx site
sudo ln -sf /etc/nginx/sites-available/simple-softphone /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'simple-softphone',
    script: './backend/server.js',
    cwd: '/opt/asterisk-call-system',
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

# Create logs directory
mkdir -p logs

# Start application
echo "🚀 Starting application..."
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Access your softphone at: http://46.62.157.243"
echo "📊 Check status: pm2 status"
echo "📝 View logs: pm2 logs simple-softphone"
echo ""
echo "🧪 Test commands:"
echo "   curl http://localhost:3001/api/health"
echo "   curl -u softphone:softphone123 http://localhost:8088/asterisk/ari/asterisk/info"
echo ""