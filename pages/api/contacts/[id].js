import { supabase } from '../../../lib/supabase';

const VALID_STATUSES = ['pending','no_answer','answered','callback','interested','not_interested','scheduled'];

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const { data: contact, error } = await supabase
      .from('contacts').select('*').eq('id', id).single();
    if (error) return res.status(404).json({ error: 'Not found' });

    const { data: outcomes } = await supabase
      .from('outcomes')
      .select('*, calls!call_id(twilio_sid, started_at, duration)')
      .eq('calls.contact_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    return res.json({ contact, outcomes: outcomes || [] });
  }

  if (req.method === 'PATCH') {
    const allowed = ['status','notes','callback_at','scheduled_at','hibernating_until'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { error } = await supabase.from('contacts').update(updates).eq('id', id);
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
