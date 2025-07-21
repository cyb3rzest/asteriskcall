# Asterisk Call Management System

A complete call management system with React frontend and Node.js backend for Asterisk PBX.

## Features
- Make outbound calls
- Add self and customer numbers
- Call hold functionality
- Call recording
- Real-time call status updates

## Tech Stack
- Frontend: React with Material-UI
- Backend: Node.js with Express
- PBX: Asterisk with PJSIP
- WebSocket for real-time updates

## Installation Guide

See INSTALLATION.md for complete setup instructions.

## Quick Start

### For Development
1. Install dependencies: `npm run install-all`
2. Start backend: `npm run server`
3. Start frontend: `npm run client`
4. Access at http://localhost:3000

### For Production (Ubuntu 24)
1. Run setup script: `sudo bash setup.sh`
2. Access at http://YOUR_SERVER_IP

## Usage Guide

### Making Calls
1. Enter your extension number (e.g., 6001) in "Self Number"
2. Enter the destination number in "Customer Number"
3. Click "Dial Now" to initiate the call

### Call Management
- **Hold**: Put active calls on hold
- **Resume**: Resume held calls
- **Record**: Start recording active calls
- **Hangup**: End active calls

### Default Extensions
- Extension 6001: Password `secure123`
- Extension 6002: Password `secure123`

### SIP Client Configuration
Configure your SIP client with:
- Server: YOUR_SERVER_IP:5060
- Username: 6001 (or 6002)
- Password: secure123
- Transport: UDP/TCP