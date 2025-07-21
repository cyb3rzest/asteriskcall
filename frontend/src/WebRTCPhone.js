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
  const [password, setPassword] = useState('secure123');
  const [isRegistered, setIsRegistered] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [callStatus, setCallStatus] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [error, setError] = useState('');
  const [callNumber, setCallNumber] = useState('');

  const audioRef = useRef(null);
  const localStreamRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);

  // WebSocket connection for SIP signaling
  useEffect(() => {
    // For now, disable WebRTC since SSL is not configured
    setError('WebRTC requires SSL/HTTPS to work properly. Please use the regular "Dial Now" feature above for now.');
    return;
  }, []);

  const handleSipMessage = (data) => {
    switch (data.type) {
      case 'registered':
        setIsRegistered(true);
        setIsConnecting(false);
        setError('');
        break;
      case 'registration_failed':
        setIsRegistered(false);
        setIsConnecting(false);
        setError('Registration failed: ' + data.message);
        break;
      case 'incoming_call':
        handleIncomingCall(data);
        break;
      case 'call_answered':
        setCallStatus('Connected');
        break;
      case 'call_ended':
        handleCallEnded();
        break;
      default:
        console.log('Unknown SIP message:', data);
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
      // Get user media first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      localStreamRef.current = stream;

      // Send registration request
      wsRef.current.send(JSON.stringify({
        type: 'register',
        sipUri: sipUri,
        password: password
      }));

    } catch (err) {
      setError('Failed to access microphone: ' + err.message);
      setIsConnecting(false);
    }
  };

  const makeCall = async (number) => {
    if (!isRegistered) {
      setError('Please register first');
      return;
    }

    try {
      // Create RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      pcRef.current = pc;

      // Add local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          wsRef.current.send(JSON.stringify({
            type: 'ice_candidate',
            candidate: event.candidate
          }));
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send call request
      wsRef.current.send(JSON.stringify({
        type: 'make_call',
        number: number,
        offer: offer
      }));

      setCurrentCall({ number, status: 'calling' });
      setCallStatus('Calling...');

    } catch (err) {
      setError('Failed to make call: ' + err.message);
    }
  };

  const handleIncomingCall = async (data) => {
    setCurrentCall({ number: data.from, status: 'incoming' });
    setCallStatus('Incoming call from ' + data.from);
  };

  const answerCall = async () => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      pcRef.current = pc;

      // Add local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
        }
      };

      wsRef.current.send(JSON.stringify({
        type: 'answer_call'
      }));

      setCallStatus('Connected');
      setCurrentCall(prev => ({ ...prev, status: 'connected' }));

    } catch (err) {
      setError('Failed to answer call: ' + err.message);
    }
  };

  const hangupCall = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    wsRef.current.send(JSON.stringify({
      type: 'hangup_call'
    }));

    handleCallEnded();
  };

  const handleCallEnded = () => {
    setCurrentCall(null);
    setCallStatus('');
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
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

  const toggleSpeaker = () => {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
      setIsSpeakerOn(!audioRef.current.muted);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>
        WebRTC Phone
      </Typography>

      {/* Registration Section */}
      {!isRegistered && (
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="SIP URI"
            value={sipUri}
            onChange={(e) => setSipUri(e.target.value)}
            placeholder="6001@46.62.157.243"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="secure123"
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
        <Alert severity="success" sx={{ mb: 2 }}>
          Registered as {sipUri}
        </Alert>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Call Status */}
      {callStatus && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {callStatus}
        </Alert>
      )}

      {/* Call Controls */}
      {currentCall && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          {currentCall.status === 'incoming' && (
            <Button
              variant="contained"
              color="success"
              onClick={answerCall}
              startIcon={<Phone />}
            >
              Answer
            </Button>
          )}
          
          <Button
            variant="contained"
            color="error"
            onClick={hangupCall}
            startIcon={<PhoneDisabled />}
          >
            Hangup
          </Button>

          {currentCall.status === 'connected' && (
            <>
              <IconButton
                onClick={toggleMute}
                color={isMuted ? 'error' : 'default'}
              >
                {isMuted ? <MicOff /> : <Mic />}
              </IconButton>

              <IconButton
                onClick={toggleSpeaker}
                color={isSpeakerOn ? 'primary' : 'default'}
              >
                {isSpeakerOn ? <VolumeUp /> : <VolumeOff />}
              </IconButton>
            </>
          )}
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
        Register with your SIP credentials to make and receive calls directly from your browser.
        Use extension 6001 or 6002 with password "secure123" for testing.
      </Typography>
    </Paper>
  );
};

export default WebRTCPhone;