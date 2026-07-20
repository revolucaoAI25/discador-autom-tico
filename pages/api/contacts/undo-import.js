import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { import_batch_id } = req.body || {};
  if (!import_batch_id) return res.status(400).json({ error: 'import_batch_id required' });

  const { data, error } = await supabase
    .from('contacts').delete().eq('import_batch_id', import_batch_id).select('id');

  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: data.length });
}
