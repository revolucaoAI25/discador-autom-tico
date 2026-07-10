import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { error } = await supabase
    .from('contacts')
    .update({ queue_order: null })
    .in('status', ['pending', 'no_answer']);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
}
