import { supabase } from '../../../lib/supabase';

const STATUS_MAP = {
  no_answer:      'no_answer',
  callback:       'called',
  interested:     'interested',
  not_interested: 'not_interested',
  voicemail:      'no_answer',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { call_id, contact_id, result, notes, next_action } = req.body;
  if (!call_id || !result) return res.status(400).json({ error: 'call_id and result required' });

  const { data, error } = await supabase
    .from('outcomes')
    .insert({ call_id, result, notes: notes || '', next_action: next_action || '' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const contactStatus = STATUS_MAP[result] || 'called';
  if (contact_id) {
    await supabase.from('contacts').update({ status: contactStatus }).eq('id', contact_id);
  }

  res.json({ id: data.id });
}
