# Installation Guide for Asterisk Call Management System

## Server Details
- IP: 46.62.157.243
- User: root
- Password: [REDACTED]
- SSH Port: 22
- OS: Ubuntu 24
- Asterisk: Version 22 (already installed)

## Prerequisites Installation

### 1. Update System
```bash
apt update && apt upgrade -y
```

### 2. Install Node.js and npm
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
```

### 3. Install PM2 for Process Management
```bash
npm install -g pm2
```

### 4. Install Additional Dependencies
```bash
apt install -y git build-essential python3-dev
```

## Asterisk Configuration

### 1. Configure PJSIP
Edit `/etc/asterisk/pjsip.conf`:
```ini
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060

[transport-tcp]
type=transport
protocol=tcp
bind=0.0.0.0:5060

[6001]
type=endpoint
context=default
disallow=all
allow=ulaw,alaw,gsm
auth=6001
aors=6001

[6001]
type=auth
auth_type=userpass
password=secure123
username=6001

[6001]
type=aor
max_contacts=1

[6002]
type=endpoint
context=default
disallow=all
allow=ulaw,alaw,gsm
auth=6002
aors=6002

[6002]
type=auth
auth_type=userpass
password=secure123
username=6002

[6002]
type=aor
max_contacts=1
```

### 2. Configure Extensions
Edit `/etc/asterisk/extensions.conf`:
```ini
[general]
static=yes
writeprotect=no

[default]
exten => _X.,1,Dial(PJSIP/${EXTEN})
exten => _X.,n,Hangup()

exten => 6001,1,Dial(PJSIP/6001,20)
exten => 6001,n,Hangup()

exten => 6002,1,Dial(PJSIP/6002,20)
exten => 6002,n,Hangup()
```

### 3. Configure Manager Interface
Edit `/etc/asterisk/manager.conf`:
```ini
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
```

### 4. Restart Asterisk
```bash
systemctl restart asterisk
systemctl enable asterisk
```

## Application Deployment

### 1. Clone and Setup Project
```bash
cd /opt
git clone [YOUR_REPO_URL] asterisk-call-system
cd asterisk-call-system
```

### 2. Install Backend Dependencies
```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies
```bash
cd ../frontend
npm install
npm run build
```

### 4. Configure Environment
Create `/opt/asterisk-call-system/backend/.env`:
```env
PORT=3001
ASTERISK_HOST=127.0.0.1
ASTERISK_PORT=5038
ASTERISK_USERNAME=admin
ASTERISK_PASSWORD=CallSystem2024!
RECORDING_PATH=/var/spool/asterisk/monitor
```

### 5. Setup PM2 Configuration
Create `/opt/asterisk-call-system/ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'asterisk-call-backend',
    script: './backend/server.js',
    cwd: '/opt/asterisk-call-system',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

### 6. Start Application
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 7. Setup Nginx (Optional)
```bash
apt install -y nginx

# Create nginx config
cat > /etc/nginx/sites-available/asterisk-call <<EOF
server {
    listen 80;
    server_name 46.62.157.243;
    
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

ln -s /etc/nginx/sites-available/asterisk-call /etc/nginx/sites-enabled/
systemctl restart nginx
systemctl enable nginx
```

### 8. Setup Firewall
```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 5060/udp
ufw allow 5060/tcp
ufw --force enable
```

## Verification

1. Check Asterisk status: `asterisk -rx "core show version"`
2. Check PM2 status: `pm2 status`
3. Check application: `curl http://localhost:3001/api/health`
4. Access web interface: `http://46.62.157.243`

## Troubleshooting

### Check Logs
```bash
# Asterisk logs
tail -f /var/log/asterisk/full

# Application logs
pm2 logs asterisk-call-backend

# System logs
journalctl -u asterisk -f
```

### Common Issues
1. **Port conflicts**: Ensure ports 3001, 5038, 5060 are available
2. **Permissions**: Check file permissions for recording directory
3. **Firewall**: Verify firewall rules allow required ports