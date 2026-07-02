import { supabase } from '../../../../lib/supabase';
import { getClient } from '../../../../lib/twilio';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id } = req.query;

  const { data: call } = await supabase
    .from('calls').select('twilio_sid').eq('id', id).single();
  if (!call?.twilio_sid) return res.status(404).json({ error: 'Not found' });

  try {
    await getClient().calls(call.twilio_sid).update({ status: 'completed' });
  } catch (_) {
    // Call may have already ended — not an error from the user's perspective
  }
  res.json({ ok: true });
}
