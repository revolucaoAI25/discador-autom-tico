import { supabase } from '../../../lib/supabase';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { CallSid, CallStatus, CallDuration } = req.body || {};

    if (CallSid && CallStatus) {
      const update = { status: CallStatus };
      if (CallStatus === 'completed' && CallDuration) update.duration = parseInt(CallDuration);
      const { error } = await supabase.from('calls').update(update).eq('twilio_sid', CallSid);
      if (error) console.error('[webhook] supabase update error:', error.message);
    }
  } catch (e) {
    console.error('[webhook] handler error:', e.message);
  }

  res.status(204).end();
}
