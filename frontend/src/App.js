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
  Snackbar,
  LinearProgress
} from '@mui/material';
import {
  Phone,
  PhoneDisabled,
  Pause,
  PlayArrow,
  CallMade,
  CallReceived
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
    background: {
      default: 'transparent'
    }
  },
});

function App() {
  const [myNumber, setMyNumber] = useState('');
  const [customerNumber, setCustomerNumber] = useState('');
  const [activeCalls, setActiveCalls] = useState([]);
  const [socket, setSocket] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [isDialing, setIsDialing] = useState(false);

  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ Connected to server');
      showNotification('Connected to softphone server', 'success');
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      showNotification('Disconnected from server', 'warning');
    });

    newSocket.on('active-calls', (calls) => {
      setActiveCalls(calls);
    });

    newSocket.on('call-update', (update) => {
      console.log('📞 Call update:', update);
      
      switch(update.type) {
        case 'call-started':
          setActiveCalls(prev => [...prev, update.call]);
          showNotification('Call started', 'info');
          setIsDialing(false);
          break;
        case 'call-ended':
          setActiveCalls(prev => prev.filter(call => call.id !== update.call.id));
          showNotification('Call ended', 'info');
          setIsDialing(false);
          break;
        case 'call-state-changed':
          updateCall(update.call);
          showNotification(`Call ${update.call.state}`, 'info');
          break;
        case 'call-held':
          updateCall(update.call);
          showNotification('Call put on hold', 'warning');
          break;
        case 'call-resumed':
          updateCall(update.call);
          showNotification('Call resumed', 'success');
          break;
        case 'call-hangup':
          updateCall(update.call);
          showNotification('Call ending...', 'info');
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

  const validatePhoneNumber = (number) => {
    return /^\d{10}$/.test(number);
  };

  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, '');
    return cleaned.slice(0, 10);
  };

  const handleMyNumberChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setMyNumber(formatted);
  };

  const handleCustomerNumberChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setCustomerNumber(formatted);
  };

  const dialCall = async () => {
    if (!myNumber || !customerNumber) {
      showNotification('Please enter both phone numbers', 'error');
      return;
    }

    if (!validatePhoneNumber(myNumber)) {
      showNotification('Please enter a valid 10-digit my number', 'error');
      return;
    }

    if (!validatePhoneNumber(customerNumber)) {
      showNotification('Please enter a valid 10-digit customer number', 'error');
      return;
    }

    setIsDialing(true);
    
    try {
      const response = await axios.post('/api/call/dial', {
        myNumber,
        customerNumber
      });

      if (response.data.success) {
        showNotification(response.data.message, 'success');
      }
    } catch (error) {
      console.error('❌ Error making call:', error);
      const errorMessage = error.response?.data?.error || 'Failed to make call';
      showNotification(errorMessage, 'error');
      setIsDialing(false);
    }
  };

  const holdCall = async (channelId) => {
    try {
      await axios.post(`/api/call/${channelId}/hold`);
    } catch (error) {
      console.error('❌ Error holding call:', error);
      showNotification('Failed to hold call', 'error');
    }
  };

  const resumeCall = async (channelId) => {
    try {
      await axios.post(`/api/call/${channelId}/resume`);
    } catch (error) {
      console.error('❌ Error resuming call:', error);
      showNotification('Failed to resume call', 'error');
    }
  };

  const hangupCall = async (channelId) => {
    try {
      await axios.post(`/api/call/${channelId}/hangup`);
    } catch (error) {
      console.error('❌ Error hanging up call:', error);
      showNotification('Failed to hangup call', 'error');
    }
  };

  const getStatusColor = (state) => {
    switch(state) {
      case 'started': return 'info';
      case 'ringing': return 'warning';
      case 'up': return 'success';
      case 'hold': return 'secondary';
      case 'ended': return 'default';
      case 'hangup': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (state) => {
    switch(state) {
      case 'started': return 'STARTING';
      case 'ringing': return 'RINGING';
      case 'up': return 'CONNECTED';
      case 'hold': return 'ON HOLD';
      case 'ended': return 'ENDED';
      case 'hangup': return 'HANGING UP';
      default: return state?.toUpperCase() || 'UNKNOWN';
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center" color="white">
          📞 Simple Softphone
        </Typography>
        <Typography variant="subtitle1" align="center" color="white" sx={{ mb: 4 }}>
          Browser-based calling with Asterisk ARI
        </Typography>

        {/* Dialing Form */}
        <Paper elevation={6} sx={{ p: 4, mb: 4, borderRadius: 3 }}>
          <Typography variant="h5" gutterBottom color="primary">
            Make a Call
          </Typography>
          
          {isDialing && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Initiating call...
              </Typography>
            </Box>
          )}
          
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={5}>
              <TextField
                fullWidth
                label="My Number"
                value={myNumber}
                onChange={handleMyNumberChange}
                placeholder="e.g., 9876543210"
                inputProps={{ maxLength: 10 }}
                helperText={`${myNumber.length}/10 digits`}
                error={myNumber.length > 0 && !validatePhoneNumber(myNumber)}
                disabled={isDialing}
              />
            </Grid>
            <Grid item xs={12} sm={5}>
              <TextField
                fullWidth
                label="Customer Number"
                value={customerNumber}
                onChange={handleCustomerNumberChange}
                placeholder="e.g., 9123456789"
                inputProps={{ maxLength: 10 }}
                helperText={`${customerNumber.length}/10 digits`}
                error={customerNumber.length > 0 && !validatePhoneNumber(customerNumber)}
                disabled={isDialing}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<Phone />}
                onClick={dialCall}
                disabled={!myNumber || !customerNumber || isDialing}
                sx={{ height: 56 }}
              >
                Dial Now
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Active Calls */}
        <Typography variant="h5" gutterBottom color="white">
          Active Calls ({activeCalls.length})
        </Typography>

        {activeCalls.length === 0 ? (
          <Paper elevation={3} sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
            <Typography variant="body1" color="text.secondary">
              No active calls
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {activeCalls.map((call) => (
              <Grid item xs={12} key={call.id}>
                <Card elevation={4} sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6">
                        📞 {call.callerNumber || 'Unknown'}
                      </Typography>
                      <Chip 
                        label={getStatusText(call.state)} 
                        color={getStatusColor(call.state)}
                        size="small"
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Channel: {call.channelId}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Started: {new Date(call.startTime).toLocaleTimeString()}
                    </Typography>
                    
                    {call.args && call.args.length > 0 && (
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Call ID: {call.args[0]}
                      </Typography>
                    )}
                  </CardContent>
                  
                  <CardActions>
                    {call.state === 'up' && (
                      <Button
                        size="small"
                        startIcon={<Pause />}
                        onClick={() => holdCall(call.channelId)}
                        color="warning"
                      >
                        Hold
                      </Button>
                    )}
                    
                    {call.state === 'hold' && (
                      <Button
                        size="small"
                        startIcon={<PlayArrow />}
                        onClick={() => resumeCall(call.channelId)}
                        color="success"
                      >
                        Resume
                      </Button>
                    )}
                    
                    {['started', 'ringing', 'up', 'hold'].includes(call.state) && (
                      <Button
                        size="small"
                        startIcon={<PhoneDisabled />}
                        color="error"
                        onClick={() => hangupCall(call.channelId)}
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