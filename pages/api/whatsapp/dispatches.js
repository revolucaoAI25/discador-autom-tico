import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('whatsapp_dispatches')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ dispatches: data || [] });
  }

  if (req.method === 'POST') {
    const { name, url } = req.body || {};
    if (!name || !url) return res.status(400).json({ error: 'name and url required' });
    const { data, error } = await supabase
      .from('whatsapp_dispatches')
      .insert({ name, url })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabase.from('whatsapp_dispatches').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
}
