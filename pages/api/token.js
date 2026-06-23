import { generateToken } from '../../lib/twilio';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const identity = process.env.TWILIO_CLIENT_IDENTITY || 'agent';
    const token = generateToken(identity);
    res.json({ token, identity });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
