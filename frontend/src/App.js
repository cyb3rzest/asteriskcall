import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Phone,
  PhoneDisabled,
  Pause,
  PlayArrow,
  FiberManualRecord,
  Stop
} from '@mui/icons-material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import io from 'socket.io-client';
import axios from 'axios';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  const [selfNumber, setSelfNumber] = useState('6001');
  const [customerNumber, setCustomerNumber] = useState('');
  const [activeCalls, setActiveCalls] = useState([]);
  const [socket, setSocket] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      showNotification('Connected to server', 'success');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      showNotification('Disconnected from server', 'warning');
    });

    newSocket.on('active-calls', (calls) => {
      setActiveCalls(calls);
    });

    newSocket.on('call-update', (update) => {
      console.log('Call update:', update);
      
      switch(update.type) {
        case 'new-call':
          setActiveCalls(prev => [...prev, update.call]);
          showNotification('New call initiated', 'info');
          break;
        case 'call-ended':
          setActiveCalls(prev => prev.filter(call => call.id !== update.call.id));
          showNotification('Call ended', 'info');
          break;
        case 'call-dialing':
          updateCall(update.call);
          showNotification('Dialing...', 'info');
          break;
        case 'call-status-changed':
          updateCall(update.call);
          showNotification(`Call ${update.call.state}`, 'success');
          break;
        case 'call-held':
          updateCall(update.call);
          showNotification('Call put on hold', 'info');
          break;
        case 'call-unheld':
          updateCall(update.call);
          showNotification('Call resumed', 'info');
          break;
        case 'recording-started':
          updateCall(update.call);
          showNotification('Recording started', 'success');
          break;
        default:
          updateCall(update.call);
      }
    });

    return () => newSocket.close();
  }, []);

  const updateCall = (updatedCall) => {
    setActiveCalls(prev => 
      prev.map(call => call.id === updatedCall.id ? updatedCall : call)
    );
  };

  const showNotification = (message, severity = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const makeCall = async () => {
    if (!selfNumber || !customerNumber) {
      showNotification('Please enter both self number and customer number', 'error');
      return;
    }

    try {
      const response = await axios.post('/api/call/originate', {
        selfNumber,
        customerNumber
      });

      if (response.data.success) {
        showNotification('Call initiated successfully', 'success');
      }
    } catch (error) {
      console.error('Error making call:', error);
      showNotification('Failed to make call', 'error');
    }
  };

  const holdCall = async (callId) => {
    try {
      await axios.post(`/api/call/${callId}/hold`);
    } catch (error) {
      console.error('Error holding call:', error);
      showNotification('Failed to hold call', 'error');
    }
  };

  const unholdCall = async (callId) => {
    try {
      await axios.post(`/api/call/${callId}/unhold`);
    } catch (error) {
      console.error('Error unholding call:', error);
      showNotification('Failed to resume call', 'error');
    }
  };

  const hangupCall = async (callId) => {
    try {
      await axios.post(`/api/call/${callId}/hangup`);
    } catch (error) {
      console.error('Error hanging up call:', error);
      showNotification('Failed to hangup call', 'error');
    }
  };

  const startRecording = async (callId) => {
    try {
      const response = await axios.post(`/api/call/${callId}/record`);
      if (response.data.success) {
        showNotification(`Recording started: ${response.data.filename}`, 'success');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      showNotification('Failed to start recording', 'error');
    }
  };

  const getStatusColor = (state) => {
    switch(state) {
      case 'ringing': return 'warning';
      case 'dialing': return 'info';
      case 'answered': return 'success';
      case 'hold': return 'secondary';
      case 'ended': return 'default';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          Asterisk Call Management System
        </Typography>

        {/* Call Initiation Form */}
        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Make a Call
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Self Number"
                value={selfNumber}
                onChange={(e) => setSelfNumber(e.target.value)}
                placeholder="e.g., 6001"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Customer Number"
                value={customerNumber}
                onChange={(e) => setCustomerNumber(e.target.value)}
                placeholder="e.g., 6002"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<Phone />}
                onClick={makeCall}
                disabled={!selfNumber || !customerNumber}
              >
                Dial Now
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Active Calls */}
        <Typography variant="h5" gutterBottom>
          Active Calls ({activeCalls.length})
        </Typography>

        {activeCalls.length === 0 ? (
          <Paper elevation={1} sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No active calls
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {activeCalls.map((call) => (
              <Grid item xs={12} md={6} key={call.id}>
                <Card elevation={2}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6">
                        Call {call.callerIdNum || 'Unknown'}
                      </Typography>
                      <Chip 
                        label={call.state.toUpperCase()} 
                        color={getStatusColor(call.state)}
                        size="small"
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Channel: {call.channel}
                    </Typography>
                    
                    {call.destination && (
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Destination: {call.destination}
                      </Typography>
                    )}
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Started: {new Date(call.startTime).toLocaleTimeString()}
                    </Typography>
                    
                    {call.recording && (
                      <Box display="flex" alignItems="center" mt={1}>
                        <FiberManualRecord color="error" sx={{ mr: 1, fontSize: 16 }} />
                        <Typography variant="body2" color="error">
                          Recording: {call.recording.filename}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                  
                  <CardActions>
                    {call.state === 'answered' && (
                      <>
                        <Button
                          size="small"
                          startIcon={<Pause />}
                          onClick={() => holdCall(call.id)}
                        >
                          Hold
                        </Button>
                        {!call.recording && (
                          <Button
                            size="small"
                            startIcon={<FiberManualRecord />}
                            color="error"
                            onClick={() => startRecording(call.id)}
                          >
                            Record
                          </Button>
                        )}
                      </>
                    )}
                    
                    {call.state === 'hold' && (
                      <Button
                        size="small"
                        startIcon={<PlayArrow />}
                        onClick={() => unholdCall(call.id)}
                      >
                        Resume
                      </Button>
                    )}
                    
                    {['answered', 'hold', 'dialing', 'ringing'].includes(call.state) && (
                      <Button
                        size="small"
                        startIcon={<PhoneDisabled />}
                        color="error"
                        onClick={() => hangupCall(call.id)}
                      >
                        Hangup
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Notification Snackbar */}
        <Snackbar
          open={notification.open}
          autoHideDuration={4000}
          onClose={handleCloseNotification}
        >
          <Alert 
            onClose={handleCloseNotification} 
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Container>
    </ThemeProvider>
  );
}

export default App;