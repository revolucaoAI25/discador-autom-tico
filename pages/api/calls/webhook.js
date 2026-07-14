import { supabase } from '../../../lib/supabase';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { CallSid, CallStatus, CallDuration } = req.body;

  // Respond with TwiML immediately — this endpoint fires the instant the lead
  // answers, and Twilio won't bridge to the agent until it gets this response.
  // The DB write is just bookkeeping, so it must not block that critical path.
  if (CallSid && CallStatus) {
    const update = { status: CallStatus };
    if (CallStatus === 'completed' && CallDuration) update.duration = parseInt(CallDuration);
    supabase.from('calls').update(update).eq('twilio_sid', CallSid)
      .then(({ error }) => { if (error) console.error('[webhook] update error:', error.message); });
  }

  res.setHeader('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true">
    <Client>${process.env.TWILIO_CLIENT_IDENTITY || 'agent'}</Client>
  </Dial>
</Response>`);
}
