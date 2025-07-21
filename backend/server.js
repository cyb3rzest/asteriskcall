const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Asterisk ARI Configuration
const ARI_CONFIG = {
  host: process.env.ASTERISK_HOST || 'localhost',
  port: process.env.ARI_PORT || 8088,
  username: process.env.ARI_USERNAME || 'asterisk',
  password: process.env.ARI_PASSWORD || 'asterisk',
  app: 'softphone'
};

const ARI_BASE_URL = `http://${ARI_CONFIG.host}:${ARI_CONFIG.port}/ari`;
const ARI_WS_URL = `ws://${ARI_CONFIG.host}:${ARI_CONFIG.port}/ari/events?app=${ARI_CONFIG.app}&api_key=${ARI_CONFIG.username}:${ARI_CONFIG.password}`;

// Store active calls
const activeCalls = new Map();
let ariWebSocket = null;

// ARI HTTP client
const ariClient = axios.create({
  baseURL: ARI_BASE_URL,
  auth: {
    username: ARI_CONFIG.username,
    password: ARI_CONFIG.password
  },
  timeout: 10000
});

// Connect to ARI WebSocket for events
function connectAriWebSocket() {
  console.log('🔌 Connecting to ARI WebSocket...');
  
  ariWebSocket = new WebSocket(ARI_WS_URL);
  
  ariWebSocket.on('open', () => {
    console.log('✅ Connected to Asterisk ARI WebSocket');
  });
  
  ariWebSocket.on('message', (data) => {
    try {
      const event = JSON.parse(data);
      handleAriEvent(event);
    } catch (err) {
      console.error('❌ Error parsing ARI event:', err);
    }
  });
  
  ariWebSocket.on('close', () => {
    console.log('🔌 ARI WebSocket disconnected. Reconnecting...');
    setTimeout(connectAriWebSocket, 5000);
  });
  
  ariWebSocket.on('error', (err) => {
    console.error('❌ ARI WebSocket error:', err);
  });
}

// Handle ARI events
function handleAriEvent(event) {
  console.log('📞 ARI Event:', event.type);
  
  switch(event.type) {
    case 'StasisStart':
      handleStasisStart(event);
      break;
    case 'StasisEnd':
      handleStasisEnd(event);
      break;
    case 'ChannelStateChange':
      handleChannelStateChange(event);
      break;
    case 'ChannelHangupRequest':
      handleChannelHangup(event);
      break;
  }
  
  // Broadcast event to all connected clients
  io.emit('ari-event', event);
}

function handleStasisStart(event) {
  const channel = event.channel;
  const callId = channel.id;
  
  const call = {
    id: callId,
    channelId: channel.id,
    state: 'started',
    startTime: new Date(),
    callerNumber: channel.caller.number,
    callerName: channel.caller.name,
    args: event.args || []
  };
  
  activeCalls.set(callId, call);
  
  io.emit('call-update', {
    type: 'call-started',
    call: call
  });
}

function handleStasisEnd(event) {
  const channelId = event.channel.id;
  
  if (activeCalls.has(channelId)) {
    const call = activeCalls.get(channelId);
    call.state = 'ended';
    call.endTime = new Date();
    
    io.emit('call-update', {
      type: 'call-ended',
      call: call
    });
    
    activeCalls.delete(channelId);
  }
}

function handleChannelStateChange(event) {
  const channelId = event.channel.id;
  
  if (activeCalls.has(channelId)) {
    const call = activeCalls.get(channelId);
    call.state = event.channel.state.toLowerCase();
    
    io.emit('call-update', {
      type: 'call-state-changed',
      call: call
    });
  }
}

function handleChannelHangup(event) {
  const channelId = event.channel.id;
  
  if (activeCalls.has(channelId)) {
    const call = activeCalls.get(channelId);
    call.state = 'hangup';
    
    io.emit('call-update', {
      type: 'call-hangup',
      call: call
    });
  }
}

// API Routes
app.get('/api/health', async (req, res) => {
  try {
    const response = await ariClient.get('/asterisk/info');
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      asterisk: response.data
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      error: 'Cannot connect to Asterisk ARI',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/calls', (req, res) => {
  res.json(Array.from(activeCalls.values()));
});

// Originate a call using ARI
app.post('/api/call/dial', async (req, res) => {
  const { myNumber, customerNumber } = req.body;
  
  if (!myNumber || !customerNumber) {
    return res.status(400).json({ 
      success: false,
      error: 'Both my number and customer number are required' 
    });
  }
  
  const callId = uuidv4();
  
  try {
    // Originate call using ARI
    const response = await ariClient.post('/channels', {
      endpoint: `PJSIP/${customerNumber}@tbitel`,
      app: ARI_CONFIG.app,
      appArgs: [callId, myNumber, customerNumber],
      callerId: myNumber,
      timeout: 30
    });
    
    const channel = response.data;
    
    res.json({ 
      success: true, 
      callId: channel.id,
      channelId: channel.id,
      message: `Call initiated from ${myNumber} to ${customerNumber}`,
      myNumber: myNumber,
      customerNumber: customerNumber
    });
    
  } catch (error) {
    console.error('❌ Error originating call:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      error: error.response?.data?.message || 'Failed to originate call'
    });
  }
});

// Hold a call
app.post('/api/call/:channelId/hold', async (req, res) => {
  const { channelId } = req.params;
  
  try {
    // Put channel on hold using ARI
    await ariClient.post(`/channels/${channelId}/hold`);
    
    if (activeCalls.has(channelId)) {
      const call = activeCalls.get(channelId);
      call.state = 'hold';
      
      io.emit('call-update', {
        type: 'call-held',
        call: call
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Call put on hold' 
    });
    
  } catch (error) {
    console.error('❌ Hold error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to hold call' 
    });
  }
});

// Resume a call
app.post('/api/call/:channelId/resume', async (req, res) => {
  const { channelId } = req.params;
  
  try {
    // Remove hold using ARI
    await ariClient.delete(`/channels/${channelId}/hold`);
    
    if (activeCalls.has(channelId)) {
      const call = activeCalls.get(channelId);
      call.state = 'up';
      
      io.emit('call-update', {
        type: 'call-resumed',
        call: call
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Call resumed' 
    });
    
  } catch (error) {
    console.error('❌ Resume error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to resume call' 
    });
  }
});

// Hangup a call
app.post('/api/call/:channelId/hangup', async (req, res) => {
  const { channelId } = req.params;
  
  try {
    // Hangup channel using ARI
    await ariClient.delete(`/channels/${channelId}`);
    
    res.json({ 
      success: true, 
      message: 'Call ended' 
    });
    
  } catch (error) {
    console.error('❌ Hangup error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to hangup call' 
    });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  // Send current active calls to new client
  socket.emit('active-calls', Array.from(activeCalls.values()));
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Initialize ARI connection
connectAriWebSocket();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Softphone server running on port ${PORT}`);
  console.log(`📱 Access your softphone at: http://localhost:${PORT}`);
  console.log(`🔗 ARI URL: ${ARI_BASE_URL}`);
});