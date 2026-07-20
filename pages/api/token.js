import { generateToken } from '../../lib/twilio';

// Letters, digits, dash/underscore only — this goes straight into a
// Twilio Client identity and, later, into a TwiML <Client> tag.
const SAFE_IDENTITY_RE = /^[A-Za-z0-9_-]{1,64}$/;

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    // Each browser session sends its own generated identity so Twilio never
    // has two different sessions registered under the same Client name —
    // that's what let a stray/stale session get bridged into a live call.
    const requested = typeof req.query.identity === 'string' ? req.query.identity : '';
    const identity = SAFE_IDENTITY_RE.test(requested)
      ? requested
      : (process.env.TWILIO_CLIENT_IDENTITY || 'agent');
    const token = generateToken(identity);
    res.json({ token, identity });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
