import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids required' });
  }

  // Sequential queue_order matching the given order — index 0 is dialed first.
  await Promise.all(ids.map((id, i) =>
    supabase.from('contacts').update({ queue_order: i }).eq('id', id)
  ));

  res.json({ ok: true });
}
