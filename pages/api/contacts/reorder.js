import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { ids, startAt } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids required' });
  }

  // Sequential queue_order matching the given order — lower is dialed first.
  // Firing hundreds/thousands of updates at once can exhaust the DB connection
  // pool, so this runs in small batches instead of all at once.
  const BATCH_SIZE = 20;
  const base = typeof startAt === 'number' ? startAt : 0;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((id, j) =>
      supabase.from('contacts').update({ queue_order: base + i + j }).eq('id', id)
    ));
  }

  res.json({ ok: true });
}
