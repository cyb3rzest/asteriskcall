# Tbitel PJSIP Configuration Guide

## Overview
This document explains the Tbitel trunk configuration for your Asterisk Call Management System using PJSIP.

## Tbitel Provider Details
- **Host**: 88.151.132.26
- **Protocol**: PJSIP (SIP over UDP/TCP)
- **Codecs**: ulaw, alaw
- **DTMF**: RFC4733 (RFC2833 equivalent for PJSIP)

## PJSIP Configuration (`/etc/asterisk/pjsip.conf`)

### Tbitel Trunk Configuration
```ini
[tbitel]
type=endpoint
context=from-trunk
disallow=all
allow=ulaw,alaw
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
dtmf_mode=rfc4733

[tbitel]
type=aor
contact=sip:88.151.132.26:5060
qualify_frequency=60

[tbitel]
type=identify
endpoint=tbitel
match=88.151.132.26
```

### Configuration Explanation

#### Endpoint Section `[tbitel]`
- `type=endpoint`: Defines this as a SIP endpoint
- `context=from-trunk`: Incoming calls go to this context
- `disallow=all` + `allow=ulaw,alaw`: Only allow these codecs
- `direct_media=no`: Force media through Asterisk (good for NAT)
- `force_rport=yes`: Handle NAT properly
- `rewrite_contact=yes`: Rewrite contact header for NAT
- `rtp_symmetric=yes`: Use symmetric RTP for NAT traversal
- `dtmf_mode=rfc4733`: DTMF method (equivalent to rfc2833)

#### AOR Section `[tbitel]`
- `type=aor`: Address of Record configuration
- `contact=sip:88.151.132.26:5060`: Tbitel server address
- `qualify_frequency=60`: Send OPTIONS every 60 seconds to check connectivity

#### Identify Section `[tbitel]`
- `type=identify`: Identifies incoming calls from this IP
- `endpoint=tbitel`: Associates with the tbitel endpoint
- `match=88.151.132.26`: Match calls from this IP address

## Extensions Configuration (`/etc/asterisk/extensions.conf`)

### Outbound Calls Context
```ini
[outbound-calls]
; Handle outbound calls from web interface
exten => _XXXXXXXXXX,1,NoOp(Outbound call from ${SELF_NUMBER} to ${EXTEN})
exten => _XXXXXXXXXX,n,Set(CALLERID(num)=${SELF_NUMBER})
exten => _XXXXXXXXXX,n,Set(CALLERID(name)=${SELF_NUMBER})
exten => _XXXXXXXXXX,n,Answer()
exten => _XXXXXXXXXX,n,Wait(1)
exten => _XXXXXXXXXX,n,Playback(beep)
exten => _XXXXXXXXXX,n,Dial(PJSIP/${EXTEN}@tbitel,60,tT)
exten => _XXXXXXXXXX,n,Hangup()
```

### Key Points
- `_XXXXXXXXXX`: Matches any 10-digit number
- `PJSIP/${EXTEN}@tbitel`: Routes call through Tbitel trunk
- `60,tT`: 60-second timeout with transfer capabilities

## How It Works

### Call Flow for 10-Digit Numbers
1. **Web Interface**: User enters self number (9876543210) and customer number (9123456789)
2. **Backend**: Validates 10-digit numbers and sends to Asterisk
3. **Asterisk**: Uses `outbound-calls` context to handle the call
4. **PJSIP**: Routes call through Tbitel trunk to destination

### Example Call
- Self Number: `9876543210`
- Customer Number: `9123456789`
- Call Path: `Web → Node.js → Asterisk → PJSIP → Tbitel → Destination`

## Testing Commands

### Check PJSIP Status
```bash
asterisk -rx "pjsip show endpoints"
asterisk -rx "pjsip show aors"
asterisk -rx "pjsip show contacts"
```

### Test Tbitel Connectivity
```bash
asterisk -rx "pjsip qualify tbitel"
```

### Monitor Calls
```bash
asterisk -rx "core show channels"
asterisk -rx "pjsip show channels"
```

### Check Logs
```bash
tail -f /var/log/asterisk/full
```

## Troubleshooting

### Common Issues

1. **No Audio**: Check `direct_media=no` and `rtp_symmetric=yes`
2. **DTMF Not Working**: Verify `dtmf_mode=rfc4733`
3. **NAT Issues**: Ensure `force_rport=yes` and `rewrite_contact=yes`
4. **Connection Issues**: Check `qualify_frequency` and network connectivity

### Debug Commands
```bash
# Enable PJSIP debug
asterisk -rx "pjsip set logger on"

# Check endpoint status
asterisk -rx "pjsip show endpoint tbitel"

# Test call manually
asterisk -rx "channel originate Local/9123456789@outbound-calls extension 9876543210@default"
```

## Security Considerations

1. **Firewall**: Ensure ports 5060 (SIP) and RTP range are open
2. **Authentication**: Consider adding authentication if Tbitel supports it
3. **Encryption**: Consider TLS if supported by Tbitel

## Migration from SIP to PJSIP

Your old SIP configuration:
```ini
[tbitel]
disallow=all
allow=ulaw
allow=alaw
type=peer
host=88.151.132.26
dtmfmode=rfc2833
canreinvite=no
insecure=port,invite
context=trunkinbound
```

Has been converted to PJSIP equivalent with improved NAT handling and modern SIP stack benefits.

## Next Steps

1. Run the update script: `sudo bash update-system.sh`
2. Test with 10-digit phone numbers
3. Monitor logs for any issues
4. Adjust configuration if needed based on call quality

The system is now ready for production use with Tbitel as your telecom provider!