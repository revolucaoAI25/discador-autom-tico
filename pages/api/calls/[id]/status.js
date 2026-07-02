import { supabase } from '../../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { id } = req.query;

  const { data, error } = await supabase
    .from('calls').select('status').eq('id', id).single();
  if (error) return res.status(404).json({ error: 'Not found' });

  res.json({ status: data.status });
}
