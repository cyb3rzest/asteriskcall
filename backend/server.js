const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const AsteriskManager = require('asterisk-manager');
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

// Asterisk Manager Interface
const ami = new AsteriskManager(
  process.env.ASTERISK_PORT || 5038,
  process.env.ASTERISK_HOST || '127.0.0.1',
  process.env.ASTERISK_USERNAME || 'admin',
  process.env.ASTERISK_PASSWORD || 'admin',
  true
);

// Store active calls
const activeCalls = new Map();

// Connect to Asterisk
ami.keepConnected();

ami.on('connect', () => {
  console.log('Connected to Asterisk Manager Interface');
});

ami.on('error', (err) => {
  console.error('AMI Error:', err);
});

// Handle AMI events
ami.on('managerevent', (evt) => {
  console.log('AMI Event:', evt.event);
  
  switch(evt.event) {
    case 'Newchannel':
      handleNewChannel(evt);
      break;
    case 'Hangup':
      handleHangup(evt);
      break;
    case 'DialBegin':
      handleDialBegin(evt);
      break;
    case 'DialEnd':
      handleDialEnd(evt);
      break;
  }
  
  // Broadcast event to all connected clients
  io.emit('asterisk-event', evt);
});

function handleNewChannel(evt) {
  const callId = evt.uniqueid;
  activeCalls.set(callId, {
    id: callId,
    channel: evt.channel,
    state: 'ringing',
    startTime: new Date(),
    callerIdNum: evt.calleridnum,
    callerIdName: evt.calleridname
  });
  
  io.emit('call-update', {
    type: 'new-call',
    call: activeCalls.get(callId)
  });
}

function handleHangup(evt) {
  const callId = evt.uniqueid;
  if (activeCalls.has(callId)) {
    const call = activeCalls.get(callId);
    call.state = 'ended';
    call.endTime = new Date();
    
    io.emit('call-update', {
      type: 'call-ended',
      call: call
    });
    
    activeCalls.delete(callId);
  }
}

function handleDialBegin(evt) {
  const callId = evt.uniqueid;
  if (activeCalls.has(callId)) {
    const call = activeCalls.get(callId);
    call.state = 'dialing';
    call.destination = evt.dialstring;
    
    io.emit('call-update', {
      type: 'call-dialing',
      call: call
    });
  }
}

function handleDialEnd(evt) {
  const callId = evt.uniqueid;
  if (activeCalls.has(callId)) {
    const call = activeCalls.get(callId);
    call.state = evt.dialstatus === 'ANSWER' ? 'answered' : 'failed';
    
    io.emit('call-update', {
      type: 'call-status-changed',
      call: call
    });
  }
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/calls', (req, res) => {
  res.json(Array.from(activeCalls.values()));
});

app.post('/api/call/originate', async (req, res) => {
  const { selfNumber, customerNumber } = req.body;
  
  if (!selfNumber || !customerNumber) {
    return res.status(400).json({ error: 'Self number and customer number are required' });
  }
  
  // Validate 10-digit numbers
  const phoneRegex = /^\d{10}$/;
  if (!phoneRegex.test(selfNumber) || !phoneRegex.test(customerNumber)) {
    return res.status(400).json({ error: 'Please enter valid 10-digit phone numbers' });
  }
  
  const callId = uuidv4();
  
  try {
    // Use Local channel to handle the call flow
    const action = {
      action: 'originate',
      channel: `Local/${selfNumber}@outbound-calls`,
      context: 'outbound-calls',
      exten: customerNumber,
      priority: 1,
      callerid: `"${selfNumber}" <${selfNumber}>`,
      timeout: 30000,
      actionid: callId,
      variable: `CUSTOMER_NUMBER=${customerNumber},SELF_NUMBER=${selfNumber}`
    };
    
    ami.action(action, (err, res_ami) => {
      if (err) {
        console.error('Originate error:', err);
        return res.status(500).json({ error: 'Failed to originate call' });
      }
      
      console.log('Call originated:', res_ami);
    });
    
    res.json({ 
      success: true, 
      callId: callId,
      message: `Call initiated from ${selfNumber} to ${customerNumber}`
    });
    
  } catch (error) {
    console.error('Error originating call:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/call/:callId/hold', (req, res) => {
  const { callId } = req.params;
  const call = activeCalls.get(callId);
  
  if (!call) {
    return res.status(404).json({ error: 'Call not found' });
  }
  
  const action = {
    action: 'redirect',
    channel: call.channel,
    context: 'default',
    exten: 'hold',
    priority: 1
  };
  
  ami.action(action, (err, res_ami) => {
    if (err) {
      console.error('Hold error:', err);
      return res.status(500).json({ error: 'Failed to hold call' });
    }
    
    call.state = 'hold';
    io.emit('call-update', {
      type: 'call-held',
      call: call
    });
    
    res.json({ success: true, message: 'Call put on hold' });
  });
});

app.post('/api/call/:callId/unhold', (req, res) => {
  const { callId } = req.params;
  const call = activeCalls.get(callId);
  
  if (!call) {
    return res.status(404).json({ error: 'Call not found' });
  }
  
  const action = {
    action: 'redirect',
    channel: call.channel,
    context: 'default',
    exten: call.destination || '6001',
    priority: 1
  };
  
  ami.action(action, (err, res_ami) => {
    if (err) {
      console.error('Unhold error:', err);
      return res.status(500).json({ error: 'Failed to unhold call' });
    }
    
    call.state = 'answered';
    io.emit('call-update', {
      type: 'call-unheld',
      call: call
    });
    
    res.json({ success: true, message: 'Call resumed' });
  });
});

app.post('/api/call/:callId/hangup', (req, res) => {
  const { callId } = req.params;
  const call = activeCalls.get(callId);
  
  if (!call) {
    return res.status(404).json({ error: 'Call not found' });
  }
  
  const action = {
    action: 'hangup',
    channel: call.channel
  };
  
  ami.action(action, (err, res_ami) => {
    if (err) {
      console.error('Hangup error:', err);
      return res.status(500).json({ error: 'Failed to hangup call' });
    }
    
    res.json({ success: true, message: 'Call ended' });
  });
});

app.post('/api/call/:callId/record', (req, res) => {
  const { callId } = req.params;
  const call = activeCalls.get(callId);
  
  if (!call) {
    return res.status(404).json({ error: 'Call not found' });
  }
  
  const filename = `recording_${callId}_${Date.now()}`;
  
  const action = {
    action: 'monitor',
    channel: call.channel,
    file: filename,
    format: 'wav',
    mix: 'true'
  };
  
  ami.action(action, (err, res_ami) => {
    if (err) {
      console.error('Record error:', err);
      return res.status(500).json({ error: 'Failed to start recording' });
    }
    
    call.recording = {
      filename: filename,
      startTime: new Date()
    };
    
    io.emit('call-update', {
      type: 'recording-started',
      call: call
    });
    
    res.json({ 
      success: true, 
      message: 'Recording started',
      filename: filename
    });
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send current active calls to new client
  socket.emit('active-calls', Array.from(activeCalls.values()));
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});