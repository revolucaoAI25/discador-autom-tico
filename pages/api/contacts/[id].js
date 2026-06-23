import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const { status } = req.body;
    const valid = ['pending', 'called', 'no_answer', 'interested', 'not_interested'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const { error } = await supabase.from('contacts').update({ status }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
