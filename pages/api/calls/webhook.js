import { getDb } from '../../../lib/db';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { CallSid, CallStatus, CallDuration } = req.body;

  if (CallSid) {
    const db = getDb();
    const call = db.prepare('SELECT * FROM calls WHERE twilio_sid = ?').get(CallSid);

    if (call && CallStatus === 'completed' && CallDuration) {
      db.prepare('UPDATE calls SET duration = ? WHERE twilio_sid = ?').run(
        parseInt(CallDuration),
        CallSid
      );
    }
  }

  // Return TwiML to connect the call to the browser agent via the TwiML App
  res.setHeader('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Client>${process.env.TWILIO_CLIENT_IDENTITY || 'agent'}</Client>
  </Dial>
</Response>`);
}
