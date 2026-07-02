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

  res.status(200).end();
}
