import { supabase } from '../../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { id } = req.query;

  const { data, error } = await supabase
    .from('calls').select('status, agent_status').eq('id', id).single();
  if (error) return res.status(404).json({ error: 'Not found' });

  const { data: outcome } = await supabase
    .from('outcomes').select('id').eq('call_id', id).limit(1).maybeSingle();

  res.json({ status: data.status, agentStatus: data.agent_status, hasOutcome: !!outcome });
}
