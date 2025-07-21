# Simple Browser Softphone with Asterisk ARI

A lightweight browser-based softphone using Asterisk 22 ARI (Asterisk REST Interface).

## Features
- Browser-based calling interface
- Manual number entry (My Number + Customer Number)
- Real-time call status display
- Hold/Resume functionality
- Hangup control
- No SSL/domain requirements
- Uses Asterisk ARI for modern REST API integration

## Architecture
- **Frontend**: React with Material-UI
- **Backend**: Node.js with Express + Asterisk ARI
- **PBX**: Asterisk 22 with PJSIP
- **Communication**: REST API + WebSocket for real-time updates

## Quick Setup

1. Run setup script: `sudo bash setup.sh`
2. Access via: `http://YOUR_SERVER_IP`
3. Enter numbers and click "Dial Now"

## Usage
1. **My Number**: Your phone number
2. **Customer Number**: Number to call  
3. **Dial Now**: Start the call
4. **Hold/Resume**: Control call state
5. **Hangup**: End call