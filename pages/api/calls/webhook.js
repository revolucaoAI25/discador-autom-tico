import { supabase } from '../../../lib/supabase';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { CallSid, CallStatus, CallDuration } = req.body;

  if (CallSid && CallStatus) {
    const update = { status: CallStatus };
    if (CallStatus === 'completed' && CallDuration) update.duration = parseInt(CallDuration);
    await supabase.from('calls').update(update).eq('twilio_sid', CallSid);
  }

  // Brief filler while the browser softphone finishes its WebRTC handshake —
  // masks the ~1-3s of dead air the lead would otherwise hear after answering.
  res.setHeader('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="pt-BR" voice="Polly.Camila-Neural">Só um momento, por favor.</Say>
  <Dial answerOnBridge="true">
    <Client>${process.env.TWILIO_CLIENT_IDENTITY || 'agent'}</Client>
  </Dial>
</Response>`);
}
