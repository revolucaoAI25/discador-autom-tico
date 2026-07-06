import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids required' });
  }

  const { error } = await supabase.from('contacts').delete().in('id', ids);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ deleted: ids.length });
}
