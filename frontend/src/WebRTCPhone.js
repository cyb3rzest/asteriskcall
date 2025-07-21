import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  IconButton
} from '@mui/material';
import {
  Phone,
  PhoneDisabled,
  Mic,
  MicOff,
  VolumeUp,
  VolumeOff
} from '@mui/icons-material';

const WebRTCPhone = () => {
  const [sipUri, setSipUri] = useState('6001@46.62.157.243');
  const [password, setPassword] = useState('webrtc123');
  const [isRegistered, setIsRegistered] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [callStatus, setCallStatus] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState('');
  const [callNumber, setCallNumber] = useState('');

  const audioRef = useRef(null);
  const localStreamRef = useRef(null);

  useEffect(() => {
    // Check if we're on HTTPS
    if (window.location.protocol !== 'https:') {
      setError('WebRTC requires HTTPS. Please access this page via https://46.62.157.243');
      return;
    }
    
    // Initialize WebRTC
    initializeWebRTC();
  }, []);

  const initializeWebRTC = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      localStreamRef.current = stream;
      setError('');
      
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access to make calls.');
      console.error('WebRTC initialization error:', err);
    }
  };

  const register = async () => {
    if (!sipUri || !password) {
      setError('Please enter SIP URI and password');
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      // Simulate registration for now
      setTimeout(() => {
        setIsRegistered(true);
        setIsConnecting(false);
        setCallStatus('Ready to make calls');
      }, 1000);
      
    } catch (err) {
      setError('Registration failed: ' + err.message);
      setIsConnecting(false);
    }
  };

  const makeCall = async () => {
    if (!callNumber) {
      setError('Please enter a phone number');
      return;
    }

    if (!isRegistered) {
      setError('Please register first');
      return;
    }

    try {
      setCurrentCall({ number: callNumber, status: 'calling' });
      setCallStatus('Calling ' + callNumber + '...');
      
      // Make actual call via API
      const response = await fetch('/api/call/originate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selfNumber: sipUri.split('@')[0],
          customerNumber: callNumber
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setCallStatus('Call initiated successfully');
        setTimeout(() => {
          setCallStatus('Connected to ' + callNumber);
          setCurrentCall(prev => ({ ...prev, status: 'connected' }));
        }, 3000);
      } else {
        setError('Failed to make call: ' + result.error);
        setCurrentCall(null);
        setCallStatus('');
      }
      
    } catch (err) {
      setError('Failed to make call: ' + err.message);
      setCurrentCall(null);
      setCallStatus('');
    }
  };

  const hangupCall = () => {
    setCurrentCall(null);
    setCallStatus('Call ended');
    
    setTimeout(() => {
      setCallStatus('Ready to make calls');
    }, 2000);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const unregister = () => {
    setIsRegistered(false);
    setCurrentCall(null);
    setCallStatus('');
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>
        WebRTC Phone
      </Typography>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Registration Section */}
      {!isRegistered && !error.includes('HTTPS') && (
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="SIP URI"
            value={sipUri}
            onChange={(e) => setSipUri(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            onClick={register}
            disabled={isConnecting}
            startIcon={isConnecting ? <CircularProgress size={20} /> : <Phone />}
          >
            {isConnecting ? 'Registering...' : 'Register'}
          </Button>
        </Box>
      )}

      {/* Registration Status */}
      {isRegistered && (
        <Box>
          <Alert severity="success" sx={{ mb: 2 }}>
            Registered as {sipUri}
          </Alert>

          {/* Call Status */}
          {callStatus && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {callStatus}
            </Alert>
          )}

          {/* Make Call Section */}
          {!currentCall && (
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                label="Phone Number"
                value={callNumber}
                onChange={(e) => setCallNumber(e.target.value)}
                placeholder="Enter 10-digit number"
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                onClick={makeCall}
                startIcon={<Phone />}
                disabled={!callNumber}
              >
                Call
              </Button>
            </Box>
          )}

          {/* Call Controls */}
          {currentCall && (
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Button
                variant="contained"
                color="error"
                onClick={hangupCall}
                startIcon={<PhoneDisabled />}
              >
                Hangup
              </Button>

              {currentCall.status === 'connected' && (
                <IconButton
                  onClick={toggleMute}
                  color={isMuted ? 'error' : 'default'}
                >
                  {isMuted ? <MicOff /> : <Mic />}
                </IconButton>
              )}
            </Box>
          )}

          <Button
            variant="outlined"
            onClick={unregister}
            sx={{ mt: 2 }}
          >
            Unregister
          </Button>
        </Box>
      )}

      {/* Audio Element */}
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        style={{ display: 'none' }}
      />

      {/* Instructions */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        {window.location.protocol === 'https:' 
          ? 'WebRTC is enabled with SSL. Register to make calls directly from your browser.'
          : 'Please access this page via HTTPS to enable WebRTC functionality.'
        }
      </Typography>
    </Paper>
  );
};

export default WebRTCPhone;