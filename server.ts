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
