import { supabase } from '../../../lib/supabase';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { CallSid, CallStatus, CallDuration } = req.body;

  if (CallSid && CallStatus === 'completed' && CallDuration) {
    await supabase
      .from('calls')
      .update({ duration: parseInt(CallDuration) })
      .eq('twilio_sid', CallSid);
  }

  res.setHeader('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Client>${process.env.TWILIO_CLIENT_IDENTITY || 'agent'}</Client>
  </Dial>
</Response>`);
}
