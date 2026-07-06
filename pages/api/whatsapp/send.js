import { supabase } from '../../../lib/supabase';

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return '55' + digits;
}

function toStartCase(name) {
  return (name || '').split(' ')[0].charAt(0).toUpperCase() +
    (name || '').split(' ')[0].slice(1).toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { dispatch_id, contact_id } = req.body || {};
  if (!dispatch_id || !contact_id) return res.status(400).json({ error: 'dispatch_id and contact_id required' });

  const [{ data: dispatch }, { data: contact }] = await Promise.all([
    supabase.from('whatsapp_dispatches').select('*').eq('id', dispatch_id).single(),
    supabase.from('contacts').select('*').eq('id', contact_id).single(),
  ]);

  if (!dispatch) return res.status(404).json({ error: 'Disparo não encontrado' });
  if (!contact)  return res.status(404).json({ error: 'Contato não encontrado' });

  const phone = normalizePhone(contact.phone);
  const name  = toStartCase(contact.lead_name || contact.name);

  try {
    const r = await fetch(dispatch.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).json({ error: `Chatflux retornou ${r.status}: ${txt}` });
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
