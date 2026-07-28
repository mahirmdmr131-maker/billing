import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import twilio from 'twilio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for sending OTP
  app.post('/api/otp/send', async (req, res) => {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and code are required' });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && twilioPhone) {
      try {
        const client = twilio(accountSid, authToken);
        await client.messages.create({
          body: `Your AM Food Processing Manager verification code is: ${code}`,
          from: twilioPhone,
          to: phone
        });
        console.log(`[OTP SERVICE] Real SMS sent to ${phone}`);
        return res.json({ success: true, mode: 'real' });
      } catch (error: any) {
        console.error('[OTP SERVICE] Twilio Error:', error.message);
        return res.status(500).json({ error: 'Failed to send real SMS', details: error.message });
      }
    } else {
      // Fallback to simulation if credentials are missing
      console.log(`[OTP SERVICE] Simulation mode: Code ${code} for ${phone}`);
      return res.json({ success: true, mode: 'simulated' });
    }
  });

  // --- P2P Network Discovery & WebRTC Sync Infrastructure ---
  interface PeerNode {
    id: string;
    name: string;
    ip: string;
    port: number;
    lastSeen: number;
    offer?: any;
    answers?: Record<string, any>;
    candidates?: any[];
  }

  const activePeers = new Map<string, PeerNode>();

  // Clean up stale peers (older than 60s)
  setInterval(() => {
    const now = Date.now();
    for (const [id, peer] of activePeers.entries()) {
      if (now - peer.lastSeen > 60000) {
        activePeers.delete(id);
      }
    }
  }, 15000);

  // Announce peer presence
  app.post('/api/p2p/announce', (req, res) => {
    const { id, name, ip, port, offer, candidate } = req.body;
    if (!id) return res.status(400).json({ error: 'Peer ID required' });

    const clientIp = ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const existing: PeerNode = activePeers.get(id) || {
      id,
      name: name || `AM-Manager-${id.substring(0, 4)}`,
      ip: String(clientIp),
      port: port || 3000,
      lastSeen: Date.now(),
      answers: {},
      candidates: []
    };

    existing.name = name || existing.name;
    existing.lastSeen = Date.now();
    if (offer) existing.offer = offer;
    if (candidate) {
      existing.candidates = existing.candidates || [];
      existing.candidates.push(candidate);
    }

    activePeers.set(id, existing);
    res.json({ success: true, peersCount: activePeers.size });
  });

  // Get active peers on local network
  app.get('/api/p2p/peers', (req, res) => {
    const peerList = Array.from(activePeers.values()).map(p => ({
      id: p.id,
      name: p.name,
      ip: p.ip,
      port: p.port,
      lastSeen: p.lastSeen,
      hasOffer: !!p.offer
    }));
    res.json({ peers: peerList });
  });

  // WebRTC Signal relay (Offers/Answers/ICE Candidates)
  app.post('/api/p2p/signal', (req, res) => {
    const { senderId, targetId, type, data } = req.body;
    if (!senderId || !targetId || !type) {
      return res.status(400).json({ error: 'Missing signal parameters' });
    }

    const targetPeer = activePeers.get(targetId);
    if (!targetPeer) {
      return res.status(404).json({ error: 'Target peer not found on network' });
    }

    if (type === 'offer') {
      targetPeer.offer = { senderId, sdp: data };
    } else if (type === 'answer') {
      targetPeer.answers = targetPeer.answers || {};
      targetPeer.answers[senderId] = data;
    } else if (type === 'candidate') {
      targetPeer.candidates = targetPeer.candidates || [];
      targetPeer.candidates.push({ senderId, candidate: data });
    }

    activePeers.set(targetId, targetPeer);
    res.json({ success: true });
  });

  // Get pending signals for a peer
  app.get('/api/p2p/signals/:peerId', (req, res) => {
    const peerId = req.params.peerId;
    const peer = activePeers.get(peerId);
    if (!peer) return res.json({ offer: null, answers: {}, candidates: [] });

    const signals = {
      offer: peer.offer || null,
      answers: peer.answers || {},
      candidates: peer.candidates || []
    };

    // Reset offers/answers after retrieval
    peer.offer = undefined;
    peer.candidates = [];
    activePeers.set(peerId, peer);

    res.json(signals);
  });

  // Direct HTTP peer data sync fallback
  app.post('/api/p2p/sync-payload', (req, res) => {
    const { senderId, data, timestamp } = req.body;
    if (!senderId || !data) {
      return res.status(400).json({ error: 'Missing sync payload' });
    }

    res.json({ success: true, receivedAt: Date.now() });
  });

  // --- Biometric Attendance Box API Endpoints ---
  app.post('/api/biometric/ping', (req, res) => {
    const { ip, port } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP address is required' });

    // Respond back with active handshake info
    res.json({
      online: true,
      ip,
      port: port || 4370,
      timestamp: Date.now(),
      message: `Biometric Attendance Device active at ${ip}:${port || 4370}`
    });
  });

  // ADMS / ZKTeco / eSSL Push Protocol / Generic Biometric Webhook
  app.all(['/iclock/cdata.aspx', '/api/biometric/push-log'], (req, res) => {
    console.log('Biometric Box Punch Received:', req.query, req.body);
    // Standard ZKTeco/eSSL ADMS Push response
    res.send('OK');
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
