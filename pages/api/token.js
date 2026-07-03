import { generateToken } from '../../lib/twilio';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    // TEMP diagnostic: force a brand-new identity, bypassing any env var,
    // to rule out an account-side restriction stuck on the old 'agent' identity.
    const identity = 'agentdiag01';
    const token = generateToken(identity);
    res.json({ token, identity });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
