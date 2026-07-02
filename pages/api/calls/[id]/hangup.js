import { supabase } from '../../../../lib/supabase';
import { getClient } from '../../../../lib/twilio';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id } = req.query;

  const { data: call } = await supabase
    .from('calls').select('twilio_sid, agent_call_sid').eq('id', id).single();
  if (!call) return res.status(404).json({ error: 'Not found' });

  const client = getClient();
  const sids = [call.twilio_sid, call.agent_call_sid].filter(Boolean);
  await Promise.all(sids.map((sid) =>
    client.calls(sid).update({ status: 'completed' }).catch(() => {})
  ));

  res.json({ ok: true });
}
