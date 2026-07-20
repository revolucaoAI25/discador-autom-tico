import { supabase } from '../../../lib/supabase';

export const config = { api: { bodyParser: true } };

const SAFE_IDENTITY_RE = /^[A-Za-z0-9_-]{1,64}$/;

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

  // Bridge to the SPECIFIC browser session that placed this call — not a
  // fixed shared identity — so a stale/zombie session registered under the
  // same name never gets rung alongside (or instead of) the real one.
  let identity = process.env.TWILIO_CLIENT_IDENTITY || 'agent';
  if (CallSid) {
    const { data: callRow } = await supabase
      .from('calls').select('agent_identity').eq('twilio_sid', CallSid).single();
    if (callRow?.agent_identity && SAFE_IDENTITY_RE.test(callRow.agent_identity)) {
      identity = callRow.agent_identity;
    }
  }

  res.setHeader('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true">
    <Client>${identity}</Client>
  </Dial>
</Response>`);
}
